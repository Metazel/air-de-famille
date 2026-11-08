"""Tests e2e publics d'Air de famille.

Aucune photo réelle : les images de test sont générées à la volée (paysage, image
minuscule, image géante, fichiers corrompus ou vides). Les tests de régression sur
la banque familiale restent privés et ne sont jamais publiés.

Usage : python3 tests/e2e_public.py <dossier_app>
Variables : AXE (chemin d'axe.min.js), CHROME (navigateur, facultatif).

Couvre : chargement et progression du moteur, CSP et absence d'appel externe,
contrôle de qualité, masques, photos multiples, progression de l'analyse,
confidentialité, âge estimé et images simulées (v2.1, visages synthétiques),
axe-core WCAG A/AA (4 onglets, thèmes clair et sombre), largeur téléphone, focus
au clavier, entrées aux limites, stockage local, service worker et hors ligne.
"""
import sys, os, json, time, random, tempfile, threading, functools, subprocess, http.server, socketserver
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw

APP = os.path.abspath(sys.argv[1])
BASE = None
HERE = os.path.dirname(os.path.abspath(__file__))
AXE = os.environ.get("AXE", os.path.join(HERE, "node_modules", "axe-core", "axe.min.js"))
CHROME = os.environ.get("CHROME") or None
results = []
connus = []  # écarts connus et suivis au registre, non bloquants

# Politique attendue, identique à tests/garde_fous.sh : toute différence échoue.
CSP_ATTENDUE = ("default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self'; "
                "img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; "
                "manifest-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'")

# Écarts connus, déclarés finement : (règle axe, sélecteurs concernés) et éléments sans contour de focus.
# v2.1 : AdF-011 et AdF-012 corrigés, plus aucun écart connu.
AXE_CONNUS = {}
FOCUS_CONNUS = (set(), "")
# Visage synthétique dessiné à la volée (aucune photo réelle, aucune empreinte enregistrée).
FAKE = open(os.path.join(HERE, "visage_synthetique.js")).read()


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


def attendre(pg, expr, timeout=20000):
    """Attente sans eval (la CSP stricte interdit wait_for_function avec une chaîne)."""
    t0 = time.time()
    while time.time() - t0 < timeout / 1000:
        if pg.evaluate(f"() => !!({expr})"):
            return True
        pg.wait_for_timeout(150)
    raise TimeoutError(expr)


def run_axe(page, label):
    if not page.evaluate("!!window.axe"):
        page.evaluate(AXE_SRC + ";0")
    r = page.evaluate("""async () => { const r = await axe.run(document, {runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
      return r.violations.map(v => ({id:v.id, impact:v.impact, targets:v.nodes.map(n => n.target.join(' '))})) }""")
    restants = []
    for v in r:
        connu = AXE_CONNUS.get(v["id"])
        if connu and set(v["targets"]) <= connu[0]:
            connus.append(f"{label} : {v['id']} → {connu[1]}")
        else:
            restants.append(v)
    check(f"axe-core WCAG A/AA — {label}", not restants, restants)


base = serve()
ORIGINE = urlparse(base).netloc


def externe(url):
    return not url.startswith(("data:", "blob:")) and urlparse(url).netloc != ORIGINE
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox", "--ignore-certificate-errors",
                          "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
    ctx = b.new_context(ignore_https_errors=True, viewport={"width": 360, "height": 800}, device_scale_factor=2, is_mobile=True, has_touch=True, locale="fr-FR")
    ctx.grant_permissions(["camera"])
    page = ctx.new_page()
    errors, external, steps = [], [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    # Toutes les requêtes du contexte, service worker compris.
    ctx.on("request", lambda r: external.append(r.url) if externe(r.url) else None)
    # Toute violation de CSP pendant les tests est comptée.
    ctx.add_init_script("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>window.__csp.push(e.violatedDirective+' '+e.blockedURI));")

    page.add_init_script("""window.__prog=[];new MutationObserver(()=>{for(const e of document.querySelectorAll('.prog:not([hidden]) .pstep'))
      if(e.textContent&&!window.__prog.includes(e.textContent)) window.__prog.push(e.textContent);}).observe(document,{subtree:true,childList:true,characterData:true,attributes:true});""")
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
    norm = lambda c: sorted(" ".join(d.split()) for d in c.split(";") if d.strip())
    check("CSP identique à la politique attendue", norm(csp) == norm(CSP_ATTENDUE), csp)

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
    check("Aucune requête vers un autre site (chargement)", not external, external[:5])

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
    faibles = set(weak) - FOCUS_CONNUS[0]
    if set(weak) & FOCUS_CONNUS[0]:
        connus.append(f"focus sans contour : {sorted(set(weak) & FOCUS_CONNUS[0])} → {FOCUS_CONNUS[1]}")
    check("Focus visible au clavier (contour) sur les 10 premiers éléments", not faibles, sorted(faibles))

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

    # Progression de l'analyse (CU6) et annulation
    prog = page.evaluate("window.__prog")
    check("Analyse : progression par étapes nommées", any("Étape" in t for t in prog), prog[:4])
    page.set_input_files("#file0", os.path.join(FIX, "geante.jpg"))
    page.wait_for_selector(".slot[data-i='0'] .prog:not([hidden]) .pcancel", timeout=5000)
    page.click(".slot[data-i='0'] .pcancel")
    page.wait_for_timeout(400)
    st = page.evaluate("[AirDeFamille.slots[0].status, !!document.querySelector('.slot[data-i=\"0\"] .prog:not([hidden])')]")
    check("Analyse : annulation possible, la photo est retirée", st == ["empty", False], st)
    srs = page.inner_text("#toasts")
    check("Analyse : annulation annoncée (zone de messages lue par le lecteur d'écran)", "annulée" in srs, " ".join(srs.split())[:80])
    check("Analyse : le focus reste dans l'emplacement après annulation", page.evaluate("!!document.activeElement.closest('.slot')"), page.evaluate("document.activeElement.className"))

    # Caméra refusée : repli sur l'import de photo
    pd = ctx.new_page()
    pd.add_init_script("navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('refus', 'NotAllowedError'))")
    pd.goto(base, wait_until="load")
    attendre(pd, "window.AirDeFamille && AirDeFamille.engine.ready", 120000)
    pd.click(".slot[data-i='0'] [data-act=cam]")
    pd.check("#camConsent")
    pd.click("#camGo")
    pd.wait_for_selector("#camNoCam:not([hidden])", timeout=20000)
    check("Caméra refusée : message et choix d'une photo proposés", pd.is_visible("#camFile") and "indisponible" in pd.inner_text("#camText").lower())
    pd.close()

    # Lot 1 avec visages synthétiques
    page.evaluate(FAKE)
    page.evaluate("""async () => { const A = window.AirDeFamille;
      const a = __fakeFace(1, {age: 40, family: 1}), b = __fakeFace(2, {age: 12, family: 1, sharp: 2});
      await A.putCanvas(A.slots[0], a.canvas, {name: 'Paul', age: 40, det: a.det});
      await A.putCanvas(A.slots[1], b.canvas, {name: 'Léa', det: b.det}); }""")
    page.wait_for_timeout(400)
    check("Résultats affichés (styles calculés sans 'unsafe-inline')", page.is_visible("#results") and page.evaluate("getComputedStyle(document.querySelector('.g-mark')).left") != "auto",
          page.evaluate("getComputedStyle(document.querySelector('.g-mark')).left"))
    gb = page.inner_text(".slot[data-i='1'] .gatebox") if page.locator(".slot[data-i='1'] .gatebox").count() else ""
    check("Contrôle de qualité : photo floue → « à reprendre » avec la raison", "floue" in gb, " ".join(gb.split()))
    check("Contrôle de qualité : photo correcte acceptée", page.locator(".slot[data-i='0'] .gatebox").count() == 0)
    page.evaluate("""async () => { const A = window.AirDeFamille; const z = __fakeFace(5, {age: 40, zigzag: true});
      await A.putCanvas(A.slots[2], z.canvas, {name: 'Zoé', age: 40, det: z.det}); }""")
    page.wait_for_timeout(300)
    gz = page.inner_text(".slot[data-i='2'] .gatebox") if page.locator(".slot[data-i='2'] .gatebox").count() else ""
    page.evaluate("document.querySelectorAll('#traits details').forEach(d => d.open = true)")
    run_axe(page, "3 photos, héritage et détails des traits ouverts (AdF-030)")
    page.evaluate("document.querySelectorAll('#traits details').forEach(d => d.open = false)")
    check("Contrôle de qualité : repères mal placés (contour irrégulier) → « à reprendre » (AdF-027)", "repères mal placés" in gz, " ".join(gz.split()))
    page.click(".slot[data-i='2'] .x")
    page.wait_for_timeout(200)
    for scheme in ["light", "dark"]:
        page.emulate_media(color_scheme=scheme)
        run_axe(page, f"résultats et contrôle de qualité / {scheme}")
    page.emulate_media(color_scheme="light")
    page.click(".slot[data-i='1'] [data-act=keep]")
    page.wait_for_timeout(200)
    kept = page.inner_text(".slot[data-i='1'] .chips")
    check("Contrôle de qualité : « Garder » laisse la photo et le signale", "Gardée malgré" in kept and "Résultat moins sûr" in page.inner_text("#scoreCard"))
    notes = page.inner_text("#scoreCard")
    check("Âge estimé signalé, avec accès au champ âge (AdF-021)", "Âge estimé pour Léa" in notes)
    page.click("#scoreCard [data-age]")
    check("Le lien « Indiquer l'âge réel » place le focus dans le champ âge", page.evaluate("document.activeElement.id") == "age1")
    page.click(".slot[data-i='0'] [data-act=check]")
    page.wait_for_timeout(200)
    check("Masques : fenêtre ouverte, focus à l'intérieur", page.is_visible("#maskSheet") and page.evaluate("!!document.activeElement.closest('#maskSheet')"))
    run_axe(page, "fenêtre des masques")
    page.check("#maskList input[data-k=beard]")
    page.click("#maskGo")
    page.wait_for_timeout(300)
    wa = page.inner_text(".slot[data-i='0'] .chips")
    check("Masques : barbe confirmée → prise en compte et signalée", "Barbe" in wa and "Masques vérifiés" in wa, " ".join(wa.split())[:120])
    page.click(".slot[data-i='0'] [data-act=check]")
    page.wait_for_timeout(200)
    page.check("#maskList input[data-k=glasses]")
    page.click("#maskGo")
    page.wait_for_timeout(300)
    ty = page.inner_text("#traits details[data-id=yeux]")
    te = page.locator("#traits details[data-id=ecart]")
    te.locator("summary").click()
    check("Lunettes confirmées : trait Yeux non mesurable, coins internes retirés (AdF-028)",
          "non mesurable : lunettes" in ty and "—" in ty and "Coins internes" not in te.inner_text() and "coins internes" in te.inner_text(), " ".join(ty.split())[:80])
    run_axe(page, "lunettes confirmées")
    page.click(".slot[data-i='0'] [data-act=check]")
    page.wait_for_timeout(200)
    page.uncheck("#maskList input[data-k=glasses]")
    page.click("#maskGo")
    page.wait_for_timeout(300)
    check("Lunettes décochées : trait Yeux à nouveau mesuré", "non mesurable" not in page.inner_text("#traits details[data-id=yeux]"))
    page.evaluate("async () => { const A = window.AirDeFamille; const e = __fakeFace(3, {age: 41, family: 1}); await A.addExtra(A.slots[0], null, e.det); }")
    page.wait_for_timeout(300)
    check("Photos multiples : « 2 photos utilisées » et note sous le score", "2 photos utilisées" in page.inner_text(".slot[data-i='0'] .chips") and "2 photos combinées" in page.inner_text("#scoreCard"))
    page.click(".slot[data-i='0'] [data-act=less]")
    page.wait_for_timeout(200)
    check("Photos multiples : retrait des ajouts", "photos utilisées" not in page.inner_text(".slot[data-i='0'] .chips"))
    page.click("#privacyBtn")
    page.wait_for_timeout(200)
    pv = page.inner_text("#privacySheet")
    check("Confidentialité : fenêtre accessible depuis l'accueil (AdF-003)", page.is_visible("#privacySheet") and "biométriques" in pv and "GitHub Pages" in pv)
    run_axe(page, "fenêtre de confidentialité")
    page.keyboard.press("Escape")
    page.wait_for_timeout(200)
    check("Confidentialité : Échap ferme et rend le focus", not page.is_visible("#privacySheet") and page.evaluate("document.activeElement.id") == "privacyBtn")
    page.click("#tab-fusion")
    page.wait_for_timeout(1500)
    cap = page.inner_text("#fuCapM") if page.is_visible("#fuCapM") else ""
    check("Fusion : mention « Image simulée » (AdF-024)", "Image simulée" in cap, cap)
    page.click("#tab-comparer")
    for i in (1, 0):
        page.click(f".slot[data-i='{i}'] .x")
    page.wait_for_timeout(200)

    # Prise de vue guidée (lot 2, CU1 et CU2) : choix de la consigne (fonction pure)
    cas = [
        ("aucun visage", {"face": False}, "self", "noface"),
        ("trop sombre", {"face": True, "light": 30, "around": 40, "size": 0.2, "cx": 0, "cy": 0, "yaw": 0, "pitch": 0.5, "roll": 0}, "self", "dark"),
        ("contre-jour", {"face": True, "light": 80, "around": 200, "size": 0.4, "cx": 0, "cy": 0, "yaw": 0, "pitch": 0.5, "roll": 0}, "self", "backlight"),
        ("trop loin", {"face": True, "light": 120, "around": 120, "size": 0.2, "cx": 0, "cy": 0, "yaw": 0, "pitch": 0.5, "roll": 0}, "self", "closer"),
        ("trop près", {"face": True, "light": 120, "around": 120, "size": 0.8, "cx": 0, "cy": 0, "yaw": 0, "pitch": 0.5, "roll": 0}, "self", "farther"),
        ("décalé, caméra avant", {"face": True, "light": 120, "around": 120, "size": 0.4, "cx": 0.2, "cy": 0, "yaw": 0, "pitch": 0.5, "roll": 0}, "self", "phoneLeft"),
        ("décalé, caméra arrière", {"face": True, "light": 120, "around": 120, "size": 0.4, "cx": 0.2, "cy": 0, "yaw": 0, "pitch": 0.5, "roll": 0}, "other", "aimRight"),
        ("trop bas dans l'image", {"face": True, "light": 120, "around": 120, "size": 0.4, "cx": 0, "cy": 0.2, "yaw": 0, "pitch": 0.5, "roll": 0}, "self", "phoneDown"),
        ("tête tournée", {"face": True, "light": 120, "around": 120, "size": 0.4, "cx": 0, "cy": 0, "yaw": 0.12, "pitch": 0.5, "roll": 0}, "self", "headRight"),
        ("menton levé", {"face": True, "light": 120, "around": 120, "size": 0.4, "cx": 0, "cy": 0, "yaw": 0, "pitch": 0.3, "roll": 0}, "self", "chinDown"),
        ("menton baissé", {"face": True, "light": 120, "around": 120, "size": 0.4, "cx": 0, "cy": 0, "yaw": 0, "pitch": 0.8, "roll": 0}, "self", "chinUp"),
        ("tête penchée", {"face": True, "light": 120, "around": 120, "size": 0.4, "cx": 0, "cy": 0, "yaw": 0, "pitch": 0.5, "roll": 15}, "self", "rollRight"),
        ("tête penchée de l'autre côté", {"face": True, "light": 120, "around": 120, "size": 0.4, "cx": 0, "cy": 0, "yaw": 0, "pitch": 0.5, "roll": -15}, "self", "rollLeft"),
        ("bien placé", {"face": True, "light": 120, "around": 120, "size": 0.45, "cx": 0.02, "cy": -0.03, "yaw": 0.01, "pitch": 0.52, "roll": 2}, "self", "ok"),
    ]
    rate = [(n, page.evaluate("([m, mode]) => AirDeFamille.guide(m, mode).key", [m, mode]), k) for n, m, mode, k in cas]
    check("Guidage : une consigne juste dans 14 situations, lumière d'abord, sens de la tête penchée", all(g == k for _, g, k in rate), [r for r in rate if r[1] != r[2]])
    # Mesure de lumière en portrait (AdF-033) : image réduite 64 × 114, cadre du visage en coordonnées 320 px
    lum = page.evaluate("""() => { const w = 64, h = 114, d = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, f = x >= 16 && x < 48 && y >= 60 && y < 100; d[i] = d[i+1] = d[i+2] = f ? 200 : 20; d[i+3] = 255; }
      return AirDeFamille.live.lumStats(new ImageData(d, w, h), { x: 80, y: 300, width: 160, height: 200 }, 64 / 320); }""")
    check("Guidage : lumière du visage et du fond mesurées au bon endroit en portrait (AdF-033)", abs(lum["face"] - lum["around"]) > 100 and lum["face"] > lum["around"], lum)
    # Fermeture pendant le chargement (AdF-031) : aucune caméra rallumée ensuite
    page.evaluate("""() => { window.__streams = []; const g = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (c) => { await new Promise((r) => setTimeout(r, window.__gumDelay || 0)); const st = await g(c); window.__streams.push(st); return st; }; }""")
    page.click(".slot[data-i='1'] [data-act=cam]")
    page.check("#camConsent")
    page.click("#camGo")
    page.wait_for_timeout(150)
    page.keyboard.press("Escape")
    page.wait_for_timeout(4000)
    fuite = page.evaluate("[AirDeFamille.camState().open, window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length]")
    check("Caméra : fermée pendant le chargement du guidage, la caméra ne s'allume pas (AdF-031)", fuite == [False, 0], fuite)
    # Parcours caméra (caméra simulée de Chromium : aucun visage, aucune image réelle)
    page.click(".slot[data-i='1'] [data-act=cam]")
    page.wait_for_timeout(200)
    check("Caméra : accord demandé avant d'ouvrir la caméra (AdF-024)", page.is_visible("#camIntro") and page.is_disabled("#camGo") and not page.evaluate("AirDeFamille.camState().open"))
    run_axe(page, "prise de vue guidée, accord")
    page.check("#camConsent")
    page.click("#camGo")
    attendre(page, "AirDeFamille.camState().open && AirDeFamille.camState().text.length > 0", 20000)
    page.wait_for_timeout(1500)
    st = page.evaluate("AirDeFamille.camState()")
    check("Caméra : flux ouvert, guidage actif (petits modèles chargés), consigne affichée (aucun visage dans l'image simulée)", st["open"] and st["guided"] and "visage" in st["text"], st)
    run_axe(page, "prise de vue guidée, caméra")
    page.click("#camVoice")
    check("Caméra : voix coupable (WCAG 1.4.2)", page.get_attribute("#camVoice", "aria-pressed") == "false")
    check("Caméra : consigne copiée dans la zone lue par TalkBack quand la voix est coupée", page.wait_for_timeout(2500) is None and len(page.evaluate("document.querySelector('#camSay').textContent")) > 0)
    check("Caméra : choix d'une photo toujours proposé", page.is_visible("#camFile2"))
    # Arrière-plan (AdF-034) : caméra coupée, reprise par un geste
    page.evaluate("Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(200)
    st = [page.evaluate("AirDeFamille.camState().open"), page.is_visible("#camPaused"), page.is_disabled("#camShot")]
    page.evaluate("Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(500)
    check("Caméra : coupée en arrière-plan, rien ne se rallume seul", st == [False, True, True] and not page.evaluate("AirDeFamille.camState().open"), st)
    page.click("#camResume")
    attendre(page, "AirDeFamille.camState().open", 10000)
    check("Caméra : « Reprendre la caméra » rouvre le flux", page.evaluate("AirDeFamille.camState().open") and page.is_hidden("#camPaused"))
    # Double déclenchement (AdF-032) : prise lente simulée, un seul envoi à l'emplacement
    page.evaluate("""() => { window.__tp = 0; window.__gen0 = AirDeFamille.slots[1].gen; window.ImageCapture = class { constructor(t) {} async takePhoto() { window.__tp++;
      await new Promise((r) => setTimeout(r, 400)); const c = new OffscreenCanvas(640, 480); c.getContext('2d').fillRect(0, 0, 640, 480); return c.convertToBlob(); } }; }""")
    page.evaluate("() => { const b = document.querySelector('#camShot'); b.click(); b.click(); b.click(); }")
    page.wait_for_timeout(900)
    check("Caméra : un seul déclenchement pendant une prise en cours (AdF-032)", page.evaluate("[window.__tp, AirDeFamille.slots[1].gen - window.__gen0]") == [1, 1], page.evaluate("[window.__tp, AirDeFamille.slots[1].gen - window.__gen0]"))
    st = page.evaluate("[AirDeFamille.camState().open, document.querySelector('#camSheet').hidden, AirDeFamille.slots[1].status]")
    check("Caméra : « Prendre la photo » coupe la caméra et analyse la photo", st[0] is False and st[1] is True and st[2] in ("loading", "busy", "queued", "noface", "ok"), st)
    attendre(page, "['noface','ok'].includes(AirDeFamille.slots[1].status)", 30000)
    check("Caméra : photo de la caméra passée par l'analyse", page.evaluate("AirDeFamille.slots[1].status") in ("noface", "ok"))
    page.wait_for_timeout(300)
    check("Caméra : focus rendu à l'emplacement après la prise (AdF-034)", page.evaluate("document.activeElement?.closest?.('.slot')?.dataset.i") == "1", page.evaluate("document.activeElement?.outerHTML?.slice(0, 80)"))
    check("Caméra : « Photo prise » annoncé", "Photo prise" in page.evaluate("document.querySelector('#toasts').textContent"), page.evaluate("document.querySelector('#toasts').textContent"))
    page.click(".slot[data-i='1'] [data-act=cam]")
    page.check("#camConsent")
    page.click("#camGo")
    attendre(page, "AirDeFamille.camState().open", 20000)
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    check("Caméra : Échap ferme la fenêtre et coupe la caméra", not page.evaluate("AirDeFamille.camState().open") and page.is_hidden("#camSheet"))
    # Fermeture pendant l'ouverture de la caméra (AdF-031) : le flux arrivé après est arrêté
    page.evaluate("window.__gumDelay = 900")
    page.click(".slot[data-i='1'] [data-act=cam]")
    page.check("#camConsent")
    page.click("#camGo")
    page.wait_for_timeout(400)
    page.keyboard.press("Escape")
    page.wait_for_timeout(2500)
    fuite = page.evaluate("[AirDeFamille.camState().open, window.__streams.length, window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length]")
    check("Caméra : fermée pendant l'ouverture, aucun flux resté actif ni rallumé (AdF-031)", fuite[0] is False and fuite[2] == 0 and fuite[1] >= 1, fuite)
    # Changement de caméra pendant l'ouverture (AdF-035) : un seul flux actif
    page.click(".slot[data-i='1'] [data-act=cam]")
    page.check("#camConsent")
    page.click("#camGo")
    check("Caméra : « Prendre la photo » désactivé pendant la préparation (AdF-036)", page.is_disabled("#camShot"))
    attendre(page, "!document.querySelector('#camLive').hidden && window.__streams.length >= 0", 5000)
    page.wait_for_timeout(300)
    page.evaluate("document.querySelector('#camFlip').click()")
    page.wait_for_timeout(200)
    page.evaluate("document.querySelector('#camFlip').click()")
    page.wait_for_timeout(3000)
    vivants = page.evaluate("window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length")
    check("Caméra : changements de caméra pendant l'ouverture, un seul flux actif (AdF-035)", vivants == 1 and page.evaluate("AirDeFamille.camState().open"), vivants)
    # takePhoto qui ne répond jamais (AdF-035) : image de la vidéo après 2 s
    page.evaluate("""() => { window.__gen0 = AirDeFamille.slots[1].gen; window.ImageCapture = class { constructor(t) {} takePhoto() { return new Promise(() => {}); } }; }""")
    page.evaluate("document.querySelector('#camShot').click()")
    page.wait_for_timeout(2800)
    st = page.evaluate("[document.querySelector('#camSheet').hidden, AirDeFamille.slots[1].gen - window.__gen0, AirDeFamille.camState().open]")
    check("Caméra : prise qui ne répond pas, photo prise sur l'image vidéo après 2 s (AdF-035)", st == [True, 1, False], st)
    attendre(page, "['noface','ok','badfile'].includes(AirDeFamille.slots[1].status)", 30000)
    # Arrière-plan pendant l'ouverture (AdF-035) : rien d'ouvert écran masqué, reprise proposée avec le focus
    page.click(".slot[data-i='1'] [data-act=cam]")
    check("Caméra : état remis à zéro à la réouverture (AdF-036)", page.evaluate("document.querySelector('#camSay').textContent === '' && document.querySelector('#camPaused').hidden"))
    page.check("#camConsent")
    page.click("#camGo")
    attendre(page, "!document.querySelector('#camLive').hidden", 5000)
    page.wait_for_timeout(300)
    page.evaluate("Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(1500)
    vivants = page.evaluate("window.__streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === 'live').length")
    page.evaluate("Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(300)
    st = [vivants, page.evaluate("AirDeFamille.camState().open"), page.is_visible("#camPaused"), page.evaluate("document.activeElement?.id")]
    check("Caméra : arrière-plan pendant l'ouverture, caméra non allumée, focus sur « Reprendre la caméra » (AdF-035, AdF-036)", st == [0, False, True, "camResume"], st)
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    page.evaluate("window.__gumDelay = 0")
    page.click(".slot[data-i='1'] .x")
    page.wait_for_timeout(200)

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

    check("Aucune requête vers un autre site (fin des tests, service worker compris)", not external, external[:5])
    try:
        viol = page.evaluate("window.__csp || []")
    except Exception:
        viol = []
    check("Aucune violation de CSP sur la dernière page", not viol, viol[:5])
    real_errors = [e for e in errors if "Failed to load resource" not in e]
    check("Aucune erreur JavaScript", not real_errors, real_errors[:3])
    b.close()

fails = [r for r in results if not r[1]]
for c in connus:
    print(f"CONNU {c} (suivi au registre, non bloquant)")
print(f"\n{sum(1 for r in results if r[1])}/{len(results)} contrôles réussis, {len(fails)} échec(s) bloquant(s)")
json.dump([{"test": n, "ok": o, "detail": str(d)} for n, o, d in results], open(os.environ.get("RAPPORT", "rapport_e2e.json"), "w"), ensure_ascii=False, indent=1)
sys.exit(1 if fails else 0)
