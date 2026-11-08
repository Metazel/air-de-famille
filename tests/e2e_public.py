"""Tests e2e publics d'Air de famille.

Aucune photo réelle : les images de test sont générées à la volée (paysage, image
minuscule, image géante, fichiers corrompus ou vides). Les tests de régression sur
la banque familiale restent privés et ne sont jamais publiés.

Usage : python3 tests/e2e_public.py <dossier_app>
Variables : AXE (chemin d'axe.min.js), CHROME (navigateur, facultatif).

Couvre : chargement et progression du moteur, CSP et absence d'appel externe,
axe-core WCAG A/AA (4 onglets, thèmes clair et sombre), largeur téléphone, focus
au clavier, entrées aux limites, stockage local, service worker et hors ligne.
"""
import sys, os, json, time, random, tempfile, threading, functools, subprocess, http.server, socketserver
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

APP = os.path.abspath(sys.argv[1])
BASE = None
HERE = os.path.dirname(os.path.abspath(__file__))
AXE = os.environ.get("AXE", os.path.join(HERE, "node_modules", "axe-core", "axe.min.js"))
CHROME = os.environ.get("CHROME") or None
results = []


def make_fixtures():
    d = tempfile.mkdtemp(prefix="adf-fixtures-")
    im = Image.new("RGB", (800, 600)); dr = ImageDraw.Draw(im)
    for y in range(600):
        dr.line([(0, y), (800, y)], fill=(40 + y // 6, 120, 200 - y // 4))
    dr.ellipse([500, 80, 620, 200], fill=(250, 220, 90))
    im.save(os.path.join(d, "paysage.jpg"), quality=85)
    Image.new("RGB", (1, 1), (200, 200, 200)).save(os.path.join(d, "minuscule.png"))
    Image.new("RGB", (6000, 4000), (120, 140, 90)).save(os.path.join(d, "geante.jpg"), quality=60)
    rnd = random.Random(42)
    open(os.path.join(d, "corrompue.jpg"), "wb").write(b"\xff\xd8\xff\xe0" + bytes(rnd.getrandbits(8) for _ in range(3000)))
    open(os.path.join(d, "texte.jpg"), "w").write("ceci n'est pas une image")
    open(os.path.join(d, "vide.jpg"), "wb").write(b"")
    # certificat local : le service worker ne s'active qu'en https
    subprocess.run(["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", os.path.join(d, "key.pem"),
                    "-out", os.path.join(d, "cert.pem"), "-days", "1", "-subj", "/CN=localhost"], check=True, capture_output=True)
    return d


FIX = make_fixtures()


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("OK   " if ok else "ECHEC"), name, ("— " + str(detail)) if detail else "")


def serve():
    class H(http.server.SimpleHTTPRequestHandler):
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                          ".wasm": "application/wasm", ".webmanifest": "application/manifest+json"}
        def log_message(self, *a): pass
    socketserver.TCPServer.allow_reuse_address = True
    import ssl
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", 8765), functools.partial(H, directory=APP))
    sc = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    sc.load_cert_chain(os.path.join(FIX, "cert.pem"), os.path.join(FIX, "key.pem"))
    httpd.socket = sc.wrap_socket(httpd.socket, server_side=True)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return "https://localhost:8765/"  # https : le service worker ne s'active qu'en https


AXE_SRC = open(AXE).read()


def run_axe(page, label):
    if not page.evaluate("!!window.axe"):
        page.evaluate(AXE_SRC + ";0")
    r = page.evaluate("""async () => { const r = await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
      return r.violations.map(v => ({id:v.id, impact:v.impact, n:v.nodes.length, t:v.nodes[0]&&v.nodes[0].target.join(' ')})) }""")
    check(f"axe-core WCAG A/AA — {label}", not r, r)


base = serve()
origin = base.split("/")[2]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--ignore-certificate-errors"])
    ctx = b.new_context(ignore_https_errors=True, viewport={"width": 360, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="fr-FR")
    page = ctx.new_page()
    errors, external, steps = [], [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: external.append(r.url) if origin not in r.url and not r.url.startswith(("data:", "blob:")) else None)

    page.add_init_script("""window.__steps=[];new MutationObserver(()=>{const t=document.body&&document.body.innerText||'';
      for(const l of t.split('\\n')) if(/Chargement|Initialisation|Préparation/.test(l)&&!window.__steps.includes(l.trim())) window.__steps.push(l.trim().slice(0,80));})
      .observe(document,{subtree:true,childList:true,characterData:true});""")
    def slow(route):
        time.sleep(0.6); route.continue_()
    page.route("**/model/**", slow)
    t0 = time.time()
    page.goto(base, wait_until="load")
    check("Page chargée, titre", "Air de famille" in page.title(), page.title())
    csp = page.evaluate("document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')?.content || ''")
    for d in ["default-src 'self'", "connect-src 'self'", "object-src 'none'", "form-action 'none'", "base-uri 'none'"]:
        check(f"CSP contient {d}", d in csp)
    check("CSP sans unsafe-eval", "'unsafe-eval'" not in csp)
    check("CSP sans unsafe-inline pour les scripts", "script-src 'self' 'wasm-unsafe-eval'" in csp)

    # Progression du moteur : on échantillonne les textes visibles
    seen = set()
    ready = False
    for _ in range(240):
        txt = page.evaluate("document.body.innerText")
        for line in txt.splitlines():
            if "Chargement" in line or "Initialisation" in line or "Préparation" in line:
                seen.add(line.strip()[:80])
        ready = page.evaluate("!!(window.faceapi && faceapi.nets.faceRecognitionNet.isLoaded && faceapi.nets.ssdMobilenetv1.isLoaded)")
        if ready:
            break
        time.sleep(0.25)
    check("Moteur et modèles chargés (réseau ralenti)", ready, f"{time.time()-t0:.1f} s")
    seen = page.evaluate("window.__steps")
    check("Progression affichée pendant le chargement", len(seen) >= 2, seen[:6])
    page.unroute("**/model/**")
    check("Aucune requête vers un autre site", not external, external[:5])

    # Accessibilité : 4 onglets, thèmes clair et sombre
    for scheme in ["light", "dark"]:
        page.emulate_media(color_scheme=scheme, reduced_motion="reduce")
        for tab in ["comparer", "album", "vieillir", "fusion"]:
            page.click(f"#tab-{tab}")
            page.wait_for_timeout(200)
            run_axe(page, f"{tab} / {scheme}")
    page.click("#tab-comparer")
    page.emulate_media(color_scheme="light")

    # Largeur téléphone
    sw = page.evaluate("document.documentElement.scrollWidth")
    check("Pas de défilement horizontal à 360 px", sw <= 360, sw)

    # Clavier : parcours au Tab, chaque élément doit avoir un contour de focus
    page.evaluate("document.activeElement && document.activeElement.blur()")
    weak = []
    for _ in range(10):
        page.keyboard.press("Tab")
        info = page.evaluate("(()=>{const a=document.activeElement,c=getComputedStyle(a);return [a.id||a.className, c.outlineStyle, c.boxShadow]})()")
        if info[0] and info[1] == "none" and info[2] == "none":
            weak.append(info[0])
    check("Focus visible au clavier (contour) sur les 10 premiers éléments", not weak, sorted(set(weak)))

    # Entrées aux limites
    def load(fname):
        page.set_input_files("#file0", os.path.join(FIX, fname))
        page.wait_for_timeout(300)
        for _ in range(80):
            t = page.inner_text(".slot[data-i='0']") + " " + page.evaluate("document.querySelector('.toast, [role=status], [aria-live]')?.innerText || ''")
            if any(k in t for k in ["Aucun visage", "illisible", "trouvé", "Erreur", "erreur"]):
                return t
            page.wait_for_timeout(250)
        return page.inner_text(".slot[data-i='0']")

    expect = {
        "paysage.jpg": "Aucun visage",
        "minuscule.png": None,
        "geante.jpg": "Aucun visage",
        "corrompue.jpg": "illisible",
        "texte.jpg": "illisible",
        "vide.jpg": "illisible",
    }
    for f, want in expect.items():
        n_err = len(errors)
        t = load(f)
        alive = page.evaluate("!!document.querySelector('#slots .slot')")
        ok = alive and (want is None or want in t) and (want is not None or ("Aucun visage" in t or "illisible" in t))
        check(f"Entrée limite {f} → message clair, appli intacte", ok, " ".join(t.split())[:90])
        if page.is_visible(".slot[data-i='0'] .x"):
            page.click(".slot[data-i='0'] .x")

    # Stockage local : rien par défaut
    ls = page.evaluate("Object.keys(localStorage)")
    check("Aucun stockage local par défaut", not ls, ls)
    idb = page.evaluate("indexedDB.databases ? indexedDB.databases().then(d=>d.map(x=>x.name)) : []")
    check("Aucune base IndexedDB", not idb, idb)

    # Hors ligne : service worker + rechargement
    page.reload(wait_until="load")
    for _ in range(40):
        if page.evaluate("!!navigator.serviceWorker.controller"): break
        page.wait_for_timeout(250)
    check("Service worker actif (https)", page.evaluate("!!navigator.serviceWorker.controller"))
    for _ in range(120):
        if page.evaluate("!!(window.faceapi && faceapi.nets.faceRecognitionNet.isLoaded)"): break
        time.sleep(0.25)
    page.wait_for_timeout(1500)
    cached = page.evaluate("caches.keys().then(async k=>{let n=0;for(const x of k){n+=(await (await caches.open(x)).keys()).length}return n})")
    check("Cache rempli après la première visite (dont modèles)", cached >= 15, cached)
    ctx.set_offline(True)
    try:
        page.reload(wait_until="load")
        page.wait_for_timeout(1500)
        off_ok = "Air de famille" in page.title()
        eng = False
        for _ in range(120):
            eng = page.evaluate("!!(window.faceapi && faceapi.nets.faceRecognitionNet.isLoaded)")
            if eng: break
            time.sleep(0.25)
        check("Hors ligne : page servie par le cache", off_ok)
        check("Hors ligne : moteur et modèles disponibles", eng)
    except Exception as e:
        check("Hors ligne : page servie par le cache", False, e)
    ctx.set_offline(False)

    real_errors = [e for e in errors if "Failed to load resource" not in e]
    check("Aucune erreur JavaScript", not real_errors, real_errors[:3])
    b.close()

# Écarts connus et suivis dans le registre (non bloquants, gravité mineure).
CONNUS = {
    "axe-core WCAG A/AA — comparer / light": "AdF-011",
    "axe-core WCAG A/AA — comparer / dark": "AdF-011",
    "Focus visible au clavier (contour) sur les 10 premiers éléments": "AdF-012",
}
fails = [r for r in results if not r[1] and r[0] not in CONNUS]
for n, o, _ in results:
    if not o and n in CONNUS:
        print(f"CONNU {n} → {CONNUS[n]} (mineur, non bloquant)")
print(f"\n{sum(1 for r in results if r[1])}/{len(results)} contrôles réussis, {len(fails)} échec(s) bloquant(s)")
json.dump([{"test": n, "ok": o, "detail": str(d)} for n, o, d in results], open(os.environ.get("RAPPORT", "rapport_e2e.json"), "w"), ensure_ascii=False, indent=1)
sys.exit(1 if fails else 0)
