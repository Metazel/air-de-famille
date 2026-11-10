"""Tests e2e publics d'Air de famille.

Aucune photo réelle : les images de test sont générées à la volée (paysage, image
minuscule, image géante, fichiers corrompus ou vides). Les tests de régression sur
la banque familiale restent privés et ne sont jamais publiés.

Usage : python3 tests/e2e_public.py <dossier_app>
Variables : AXE (chemin d'axe.min.js), CHROME (navigateur, facultatif).

Couvre : chargement et progression du moteur, CSP et absence d'appel externe,
contrôle de qualité, masques, photos multiples, progression de l'analyse,
confidentialité, âge estimé et images simulées (v2.1, visages synthétiques),
axe-core WCAG A/AA (5 onglets, thèmes clair et sombre), largeur téléphone, focus
au clavier, entrées aux limites, stockage local, service worker et hors ligne.
v2.5 (AdF-039) : onglet Iris sur des iris de synthèse (repérage, correction au clavier et
par boutons, œil gauche/droit, qui a transmis quoi, partage en texte seul, base locale,
v2.5.1 : repérage sur photo ordinaire, reflets gris, découpe à pleine résolution, selfie retiré).
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
# Iris de synthèse (AdF-039) : motifs générés à paramètres connus, aucune vraie photo.
IRIS_SRC = open(os.path.join(HERE, "iris_synthetique.js")).read().replace("export function", "function") + ";window.irisSynthetique = irisSynthetique;0"


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

    # Accessibilité : 5 onglets (Iris compris), thèmes clair et sombre
    for scheme in ["light", "dark"]:
        page.emulate_media(color_scheme=scheme, reduced_motion="reduce")
        for tab in ["comparer", "album", "vieillir", "fusion", "iris"]:
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
    # Grand écart d'âge (AdF-038) : plus de score global au-delà de 30 ans, traits stables mis en avant
    page.evaluate("""async () => { const A = window.AirDeFamille; const b = __fakeFace(2, {age: 8, family: 1});
      await A.putCanvas(A.slots[1], b.canvas, {name: 'Léa', age: 8, det: b.det}); }""")
    page.wait_for_timeout(400)
    sc = page.inner_text("#scoreCard")
    check("Écart d'âge > 30 ans : pas de score global, traits stables, fiabilité limitée (AdF-038)",
          "pas de score global" in sc.lower() and "traits stables avec l'âge" in sc.lower() and "fiabilité limitée" in sc.lower() and "nez" in sc.lower() and page.locator("#scoreCard .gauge").count() == 0 and "%" not in page.inner_text("#tabs .num"), " ".join(sc.split())[:160])
    check("Écart d'âge > 30 ans : traits qui changent avec l'âge signalés (AdF-038)", "change avec l'âge" in page.inner_text("#traits details[data-id=visage] summary") and "change avec l'âge" not in page.inner_text("#traits details[data-id=nez] summary"))
    page.evaluate("""async () => { const A = window.AirDeFamille; const z = __fakeFace(6, {age: 30, family: 2});
      await A.putCanvas(A.slots[2], z.canvas, {name: 'Zoé', age: 30, det: z.det}); }""")
    page.wait_for_timeout(400)
    page.select_option("#refSel", "1")
    page.wait_for_timeout(300)
    hr = page.inner_text("#heritage")
    check("Héritage, une seule paire au-delà de 30 ans : paire nommée, traits stables seuls départagés, sans total (AdF-038)",
          ("Sur les traits stables" in hr or "Aucun trait stable" in hr) and "avec Paul (32 ans)" in hr and "Zoé (" not in hr and "change avec l'âge" in hr and "Au total" not in hr, " ".join(hr.split())[:300])
    check("Lien « qui a transmis quoi » depuis le score (3 photos)", page.locator("#scoreCard a[href='#heritage']").count() == 1)
    run_axe(page, "grand écart d'âge, héritage (AdF-038)")
    page.click(".slot[data-i='2'] .x")
    page.wait_for_timeout(200)
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
    # Taille et position mesurées dans la zone visible de l'aperçu, comme le cercle (AdF-037)
    vue = page.evaluate("""() => { const L = AirDeFamille.live, G = AirDeFamille.guide;
      const det = (cx, cy, w) => { const p = Array.from({ length: 68 }, () => [cx, cy]);
        p[0] = [cx - w / 2, cy]; p[16] = [cx + w / 2, cy]; p[30] = [cx, cy + w * 0.12];
        for (let i = 36; i <= 41; i++) p[i] = [cx - w * 0.2, cy - w * 0.1]; for (let i = 42; i <= 47; i++) p[i] = [cx + w * 0.2, cy - w * 0.1];
        p[51] = [cx, cy + w * 0.3]; p[57] = [cx, cy + w * 0.36];
        return { box: { x: cx - w / 2, y: cy - w * 0.65, width: w, height: w * 1.3 }, pts: p }; };
      const vis = (W, H, cw, ch) => { const k = Math.max(cw / W, ch / H), w = cw / k, h = ch / k; return { x: (W - w) / 2, y: (H - h) / 2, w, h }; };
      const lum = { face: 120, around: 120, all: 120 };
      const P = vis(320, 569, 300, 400), Lv = vis(320, 180, 300, 400);
      const portrait = L.liveMeasure(det(160, 284, 0.44 * P.w), 320, 569, lum, P);
      const paysage = L.liveMeasure(det(160, 90, 0.44 * Lv.w), 320, 180, lum, Lv);
      const decale = L.liveMeasure(det(Lv.x + Lv.w * 0.8, 90, 0.44 * Lv.w), 320, 180, lum, Lv);
      const debord = L.liveMeasure(det(160, 284, 0.55 * P.w), 320, 569, lum, P);
      const pres = L.liveMeasure(det(160, 284, 0.62 * P.w), 320, 569, lum, P);
      const loin = L.liveMeasure(det(160, 284, 0.26 * P.w), 320, 569, lum, P);
      return { portrait: G(portrait).key, paysage: G(paysage).key, decaleCx: decale.cx, debord: G(debord).key, pres: G(pres).key, loin: G(loin).key }; }""")
    check("Guidage : visage qui remplit le cercle accepté (portrait et paysage), « reculer » seulement nettement au-delà (AdF-037)", [vue["portrait"], vue["paysage"], vue["debord"], vue["pres"], vue["loin"]] == ["ok", "ok", "ok", "farther", "closer"], vue)
    check("Guidage : décalage mesuré dans la zone visible de l'aperçu (AdF-037)", abs(vue["decaleCx"] - 0.3) < 0.01, vue["decaleCx"])
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
    try:
        attendre(page, "AirDeFamille.camState().text.includes('visage')", 10000)
    except Exception:
        pass
    st = page.evaluate("AirDeFamille.camState()")
    check("Caméra : flux ouvert, guidage actif (petits modèles chargés), consigne affichée (aucun visage dans l'image simulée)", st["open"] and st["guided"] and "visage" in st["text"], st)
    run_axe(page, "prise de vue guidée, caméra")
    page.click("#camVoice")
    check("Caméra : voix coupable (WCAG 1.4.2)", page.get_attribute("#camVoice", "aria-pressed") == "false")
    check("Caméra : consigne copiée dans la zone lue par TalkBack quand la voix est coupée", page.wait_for_timeout(2500) is None and len(page.evaluate("document.querySelector('#camSay').textContent")) > 0)
    check("Caméra : choix d'une photo toujours proposé", page.is_visible("#camFile2"))
    cercle = page.evaluate("(() => { const f = document.querySelector('#camFrame').getBoundingClientRect(), v = document.querySelector('#camVideo').getBoundingClientRect(); return [f.width / v.width, (f.left + f.width / 2 - v.left) / v.width, f.height / f.width, v.width / v.height]; })()")
    check("Caméra : cercle à 44 % de la largeur visible, centré, aperçu 3:4 (AdF-037)", abs(cercle[0] - 0.44) < 0.02 and abs(cercle[1] - 0.5) < 0.01 and abs(cercle[2] - 1.36) < 0.03 and abs(cercle[3] - 0.75) < 0.02, cercle)
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

    # Base locale (lot 3, CU8, AdF-020) : désactivée par défaut, accord par personne, détection au lancement,
    # rappel annuel, suppression d'une photo et de tout. Visages synthétiques, jamais de vraie photo.
    def recharger():
        page.reload(wait_until="load")
        attendre(page, "!!window.AirDeFamille", 20000)
        page.wait_for_timeout(800)
    page.click("#tab-album")
    page.wait_for_timeout(200)
    idb = page.evaluate("indexedDB.databases().then(d=>d.map(x=>x.name))")
    check("Base : désactivée par défaut, aucune base créée", page.is_visible("#baseEnable") and not idb and not page.evaluate("AirDeFamille.baseState().on"), idb)
    page.click("#baseEnable")
    attendre(page, "AirDeFamille.baseState().on", 5000)
    check("Base : activation explicite, base créée sur l'appareil", "adf-base" in page.evaluate("indexedDB.databases().then(d=>d.map(x=>x.name))"))
    page.evaluate(FAKE)
    page.evaluate("""() => { const A = window.AirDeFamille; const a = __fakeFace(1, {age: 40, family: 1}), b = __fakeFace(2, {age: 12, family: 1}), c = __fakeFace(3, {age: 30});
      A.albumInject(a.canvas, a.det, {person: 'Paul', date: '2020-05', src: 'test', n: 1, of: 1});
      A.albumInject(b.canvas, b.det, {person: 'Léa', date: '2021-06', src: 'test', n: 1, of: 1});
      A.albumInject(c.canvas, c.det, {person: '', src: 'test', n: 1, of: 1}); }""")
    page.wait_for_timeout(300)
    run_axe(page, "album avec photos et matrice (AdF-041)")
    check("Base : « Garder » proposé seulement pour les photos nommées", page.locator("#albumGrid .bkeep").count() == 2, page.locator("#albumGrid .bkeep").count())
    page.click("#baseSaveAll")
    page.wait_for_timeout(200)
    check("Base : accord demandé pour chaque personne avant tout ajout", page.is_visible("#consentSheet") and page.locator("#consentList input").count() == 2 and page.is_disabled("#consentGo"))
    run_axe(page, "base : accord des personnes")
    page.check("#consentList input[data-k='paul']")
    page.click("#consentGo")
    attendre(page, "AirDeFamille.baseState().items === 1", 5000)
    check("Base : seules les photos des personnes ayant donné leur accord sont gardées", page.evaluate("(({on, items, people, loading}) => ({on, items, people, loading}))(AirDeFamille.baseState())") == {"on": True, "items": 1, "people": 1, "loading": False} and "Dans ma base" in page.inner_text("#albumGrid"))
    gardee = page.evaluate("""() => new Promise((ok) => { const r = indexedDB.open('adf-base'); r.onsuccess = () => { const t = r.result.transaction('items').objectStore('items').getAll(); t.onsuccess = () => { const it = t.result[0]; ok(Object.keys(it).sort()); r.result.close(); }; }; })""")
    w_ = page.locator("#albumGrid .aface:has(.chip.ok) .who").first
    check("Base : prénom verrouillé pour une photo gardée, atteignable au clavier avec son explication (AdF-042, AdF-045)", w_.evaluate("e => e.readOnly && !e.disabled && e.getAttribute('aria-describedby') === 'lockedHint'"))
    check("Base : après l'enregistrement, le focus va au prénom de la carte (AdF-045)", page.evaluate("document.activeElement.classList.contains('who') && !!document.activeElement.closest('.aface').querySelector('.chip.ok')"))
    gris = page.evaluate("""() => new Promise((ok) => { const r = indexedDB.open('adf-base'); r.onsuccess = () => { const t = r.result.transaction('items').objectStore('items').getAll(); t.onsuccess = async () => {
      const bmp = await createImageBitmap(t.result[0].jpeg), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
      const px = (x, y) => Array.from(g.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3)); r.result.close();
      const b = AirDeFamille.albumBoxes().find((q) => q.kept), cx = b.x + b.w / 2, cy = b.y + b.h * 0.42;
      ok([px(2, 2), px(bmp.width - 3, bmp.height - 3), px(cx + b.w * 0.62 + 6, cy), px(cx - b.w * 0.62 - 6, cy), px(cx, cy + b.h * 0.72 + 6)]); }; }; })""")
    check("Base : tout ce qui est hors du visage est masqué avant l'enregistrement, juste au bord de l'ellipse compris (aucun tiers, AdF-042, AdF-044)", all(abs(v - 128) <= 6 for p_ in gris for v in p_), gris)
    check("Base : ni empreinte ni mesure enregistrée (photo recadrée et informations seulement)", not any(k in gardee for k in ("det", "desc", "descriptor", "measures")) and "jpeg" in gardee, gardee)
    recharger()
    check("Base : détectée au lancement avec le nombre de personnes et de photos", page.is_visible("#baseBar") and "1 personne, 1 photo" in page.inner_text("#baseBar"), page.inner_text("#baseBar") if page.is_visible("#baseBar") else "")
    run_axe(page, "base : bandeau au lancement")
    page.evaluate("""() => new Promise((ok) => { const r = indexedDB.open('adf-base'); r.onsuccess = () => { const db = r.result, t = db.transaction('meta', 'readwrite'), old = new Date(Date.now() - 400 * 864e5).toISOString();
      t.objectStore('meta').put(old, 'created'); t.objectStore('meta').put(old, 'reminded'); t.oncomplete = () => { db.close(); ok(); }; }; })""")
    recharger()
    bar = page.inner_text("#baseBar") if page.is_visible("#baseBar") else ""
    check("Base : rappel annuel « garder ou supprimer ? »", "garder ou supprimer" in bar and page.is_visible("#baseKeep"), bar)
    page.click("#baseKeep")
    page.wait_for_timeout(300)
    recharger()
    check("Base : « Garder » repousse le rappel d'un an", "Base trouvée" in (page.inner_text("#baseBar") if page.is_visible("#baseBar") else ""))
    page.click("#baseManage")
    page.wait_for_timeout(400)
    check("Base : écran « Ma base » par personne, avec choix du chargement", page.is_visible("#manageSheet") and "Paul" in page.inner_text("#manageList") and "Charger Paul dans l'album" in page.inner_text("#manageList"))
    run_axe(page, "base : écran Ma base")
    page.uncheck("#manageList .minc")
    page.wait_for_timeout(300)
    page.click("#manageUse")
    page.wait_for_timeout(800)
    check("Base : une personne décochée n'est pas chargée", "Rien de nouveau à charger" in page.inner_text("#toasts"), page.inner_text("#toasts")[-120:])
    page.click("#baseManage2")
    page.wait_for_timeout(400)
    page.check("#manageList .minc")
    page.wait_for_timeout(300)
    page.evaluate("() => { const b = document.querySelector('#manageUse'); b.click(); b.click(); }")
    try:
        attendre(page, "document.querySelector('#toasts').textContent.includes('depuis la base')", 60000)
    except TimeoutError:
        pass
    page.wait_for_timeout(1500)
    tt = page.inner_text("#toasts")
    check("Base : chargement unique malgré un double appui, empreinte recalculée (visage synthétique non détecté : signalé sans erreur)", tt.count("chargée depuis la base") == 1 and "sans visage retrouvé" in tt, tt[-160:])
    page.click("#baseManage2")
    page.wait_for_timeout(400)
    x = page.locator("#manageList .mthumb .x").first
    x.click()
    page.wait_for_timeout(100)
    arme = [page.evaluate("AirDeFamille.baseState().items"), x.get_attribute("aria-label")]
    page.wait_for_timeout(700)
    x.click()
    attendre(page, "AirDeFamille.baseState().items === 0", 5000)
    check("Base : suppression d'une photo en deux appuis, nom du bouton mis à jour", arme[0] == 1 and "Confirmer" in (arme[1] or "") and page.evaluate("AirDeFamille.baseState().items") == 0, arme)
    check("Base : focus gardé dans la fenêtre après suppression", page.evaluate("!!document.activeElement.closest('#manageSheet')"))
    page.keyboard.press("Escape")
    # Deux onglets : une suppression dans l'un, l'autre ne recrée rien (AdF-042)
    p2 = ctx.new_page()
    p2.goto(base + "index.html", wait_until="load")
    attendre(p2, "!!window.AirDeFamille && AirDeFamille.baseState().on", 20000)
    p2.click("#tab-album")
    p2.click("#baseWipe")
    p2.wait_for_timeout(700)
    p2.click("#baseWipe")
    attendre(p2, "!AirDeFamille.baseState().on", 10000)
    p2.close()
    try:
        attendre(page, "!AirDeFamille.baseState().on", 10000)
    except TimeoutError:
        pass
    page.wait_for_timeout(500)
    check("Base : supprimée dans un autre onglet, cet onglet repasse à « désactivée » sans rien recréer", not page.evaluate("AirDeFamille.baseState().on") and not page.evaluate("indexedDB.databases().then(d=>d.map(x=>x.name))") and page.is_visible("#baseEnable"))
    page.click("#baseEnable")
    attendre(page, "AirDeFamille.baseState().on", 5000)
    page.dblclick("#baseWipe")
    page.wait_for_timeout(300)
    check("Base : un double appui rapide ne supprime pas la base (AdF-044)", page.evaluate("AirDeFamille.baseState().on") and "Confirmer" in page.inner_text("#baseWipe"))
    page.wait_for_timeout(500)
    page.click("#baseWipe")
    attendre(page, "!AirDeFamille.baseState().on", 5000)
    check("Base : « Supprimer la base » efface la base du navigateur, focus sur « Activer »", not page.evaluate("indexedDB.databases().then(d=>d.map(x=>x.name))") and page.evaluate("document.activeElement.id") == "baseEnable")

    # ===== Iris (AdF-039, MVP I1 à I5, exigences R1 à R9) =====
    pi = ctx.new_page()
    pi.on("pageerror", lambda e: errors.append(str(e)))
    pi.goto(base + "index.html#iris", wait_until="load")
    attendre(pi, "!!window.AirDeFamille && !!AirDeFamille.iris", 20000)
    pi.evaluate(IRIS_SRC)
    def iris_png(nom, params):
        import base64
        url = pi.evaluate("""(p) => { const im = irisSynthetique(p), c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
          c.getContext('2d').putImageData(new ImageData(im.data, im.width, im.height), 0, 0); return c.toDataURL('image/png'); }""", params)
        f = os.path.join(FIX, nom); open(f, "wb").write(base64.b64decode(url.split(",", 1)[1])); return f
    def importer(i, f, final="s.status !== 'busy'", delai=40000):
        """Import réel par le champ fichier, puis attente d'un état nouveau (génération changée), jamais d'un état déjà vrai."""
        g0 = pi.evaluate(f"AirDeFamille.iris.state().slots[{i}].gen")
        pi.set_input_files(f".islot[data-i='{i}'] input[type=file]", f)
        attendre(pi, f"(() => {{ const s = AirDeFamille.iris.state().slots[{i}]; return s.gen > {g0} && ({final}); }})()", delai)
    PA = {"fond": "oeil", "collerette": 0.36, "contraste": -20, "coeur": 14, "coeurAmp": 34, "sillons": 6, "sillonsAmp": 20, "cryptes": 2, "graine": 3}
    PB = {"fond": "blanc", "collerette": 0.36, "contraste": 12, "coeur": 44, "coeurAmp": 12, "spirales": 36, "spiralesAmp": 26, "cryptes": 24, "graine": 5}
    PC = {"fond": "oeil", "collerette": 0.36, "contraste": 12, "coeur": 14, "coeurAmp": 34, "spirales": 36, "spiralesAmp": 26, "cryptes": 24, "graine": 9}
    fA, fB, fC = iris_png("iris_a.png", PA), iris_png("iris_b.png", PB), iris_png("iris_c.png", PC)
    fBruit = iris_png("iris_bruit.png", {"fond": "oeil", "coeurAmp": 0, "milieuAmp": 0, "sillonsAmp": 0, "spiralesAmp": 0, "cryptes": 0, "contraste": 0, "bruit": 4})
    fPetitGrand = iris_png("iris_petit_grand.png", {"w": 5000, "h": 3000, "cx": 2500, "cy": 1500, "ri": 100, "rp": 28, "fond": "oeil", "coeur": 30})
    fBleu = iris_png("iris_bleu.png", {"w": 1800, "h": 1200, "cx": 900, "cy": 600, "ri": 260, "rp": 70, "fond": "oeil", "couleur": [150, 170, 190], "coeur": 30, "spirales": 30, "spiralesAmp": 14, "sillonsAmp": 14})
    fFonceFlou = iris_png("iris_fonce_flou.png", {"fond": "oeil", "couleur": [45, 30, 20], "coeur": 30, "coeurAmp": 26, "spirales": 30, "spiralesAmp": 14, "sillonsAmp": 14, "flou": 10})
    fAnneau = iris_png("iris_anneau.png", {"fond": "oeil", "couleur": [130, 150, 170], "coeur": 30, "coeurAmp": 26, "spirales": 30, "spiralesAmp": 14, "sillonsAmp": 14, "anneau": 30, "reflet": False})
    # Photo pivotée : pixels tournés et étiquette EXIF « Orientation = 6 » ; affichée droite, l'iris est en (450, 350).
    from PIL import Image as _Im
    _rot = _Im.open(fA).convert("RGB").rotate(90, expand=True)
    _ex = _rot.getexif(); _ex[0x0112] = 6
    fPivot = os.path.join(FIX, "iris_pivote.jpg"); _rot.save(fPivot, "JPEG", quality=92, exif=_ex.tobytes())
    Image.new("RGB", (4000, 2400), (128, 128, 128)).save(os.path.join(FIX, "gris_grand.png")); fGrisGrand = os.path.join(FIX, "gris_grand.png")
    fGrand = iris_png("iris_grand.png", {"w": 4000, "h": 2400, "cx": 2100, "cy": 1150, "ri": 300, "rp": 85, "fond": "oeil", "coeur": 30, "spirales": 30, "spiralesAmp": 14, "sillonsAmp": 12})
    fMoyen = iris_png("iris_moyen.png", {"w": 700, "h": 560, "cx": 350, "cy": 280, "ri": 110, "rp": 30, "fond": "oeil"})
    fPetit = iris_png("iris_petit.png", {"w": 300, "h": 240, "cx": 150, "cy": 120, "ri": 34, "rp": 10, "fond": "oeil"})
    Image.new("RGB", (640, 480), (128, 128, 128)).save(os.path.join(FIX, "gris.png")); fGris = os.path.join(FIX, "gris.png")
    check("Iris : onglet affiché depuis l'adresse #iris", pi.is_visible("#iris") and pi.get_attribute("#tab-iris", "aria-selected") == "true")
    run_axe(pi, "Iris, vide, thème clair")
    check("Iris (R3) : import bloqué tant que l'accord n'est pas coché", pi.is_disabled(".islot[data-i='0'] [data-act=pick]"))
    t_txt = pi.inner_text("#iris")
    check("Iris (R5, R6) : aide sans interprétation santé, sans identification", "iridologie" in t_txt and "ne reconnaît personne" in t_txt)
    pi.check("#irisAgree")
    req_avant = len(external)
    req_iris = []
    ecoute = lambda r: req_iris.append((r.method, r.url))
    ctx.on("request", ecoute)
    t0i = time.time()
    pi.set_input_files(".islot[data-i='0'] input[type=file]", fC)
    attendre(pi, "AirDeFamille.iris.state().slots[0].status === 'ready'", 30000)
    t_rep = time.time() - t0i
    st = pi.evaluate("AirDeFamille.iris.state().slots[0]")
    lm = st["lm"]
    check("Iris (I1) : pupille et bord repérés sur une photo ordinaire (paupières), à 3 % près", lm and abs(lm["cx"] - 450) < 8 and abs(lm["cy"] - 350) < 8 and abs(lm["rp"] - 70) / 70 < 0.03 and abs(lm["ri"] - 260) / 260 < 0.03, {"lm": lm, "s": round(t_rep, 1)})
    check("Iris (I1) : repérage en moins de 3 s sur ce poste", t_rep < 3, round(t_rep, 2))
    pi.set_input_files(".islot[data-i='1'] input[type=file]", fA)
    pi.set_input_files(".islot[data-i='2'] input[type=file]", fB)
    attendre(pi, "AirDeFamille.iris.state().slots.every(s => s.status === 'ready')", 40000)
    lmb = pi.evaluate("AirDeFamille.iris.state().slots[2].lm")
    check("Iris (I1) : iris détouré sur fond blanc repéré à 3 % près", abs(lmb["ri"] - 260) / 260 < 0.03 and abs(lmb["rp"] - 70) / 70 < 0.03, lmb)
    for i, n in enumerate(["Léo", "Anna", "Marc"]):
        pi.fill(f".islot[data-i='{i}'] input[data-f=name]", n)
    check("Iris (I5) : comparaison bloquée tant que l'œil n'est pas indiqué", pi.is_disabled("#irisGo") and "œil" in pi.inner_text("#irisNeed"))
    for i in range(3):
        pi.check(f".islot[data-i='{i}'] input[value=D]")
    pi.click("#irisGo")
    attendre(pi, "!!AirDeFamille.iris.state().results", 60000)
    txt = pi.evaluate("AirDeFamille.iris.state().text")
    attendu = ["Filaments du cœur : Plus proche de : Anna", "Filaments du milieu : Plus proche de : Anna", "Sillons du pourtour : Plus proche de : Marc",
               "Spirales du pourtour : Plus proche de : Marc", "Position de la collerette : Égalité entre Anna et Marc", "Contraste cœur / pourtour : Plus proche de : Marc"]
    # Cryptes : mesure encore peu sensible (AdF-046), non contrôlée ici ; présente et sans total.
    check("Iris (I4) : 6 motifs sur 7 penchent du côté attendu (trio construit), cryptes affichées, sans total", all(a in txt for a in attendu) and "Cryptes : " in txt and "%" not in txt and "score" not in txt.lower(), txt)
    check("Iris (I4) : mention « indice, pas une preuve »", "Indice, pas une preuve" in pi.inner_text("#irisResults"))
    check("Iris (I3) : trois bandes déroulées, décrites en texte pour TalkBack", pi.locator("#irisBands canvas").count() == 3 and all(len(pi.locator("#irisBands canvas").nth(k).get_attribute("aria-label") or "") > 120 for k in range(3)))
    ctx.remove_listener("request", ecoute)
    # Seules des ressources statiques du site peuvent être lues (une police au premier affichage) : aucun envoi.
    envois = [r for r in req_iris if r[0] != "GET" or not urlparse(r[1]).path.startswith(("/fonts/", "/model/", "/vendor/"))]
    check("Iris (R1) : aucun envoi pendant le repérage et l'analyse (seules des polices du site peuvent être lues)", not envois and len(external) == req_avant, req_iris[:5])
    stock = pi.evaluate("async () => ({ls: Object.keys(localStorage), db: (await indexedDB.databases()).map(d => d.name)})")
    check("Iris (R2) : rien n'est stocké par défaut", not stock["ls"] and not stock["db"], stock)
    pi.evaluate("navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; document.querySelector('#irisShare').hidden = false;")
    pi.click("#irisShare")
    pi.wait_for_timeout(200)
    sh = pi.evaluate("window.__shared || {}")
    check("Iris (R4) : partage en texte seul, aucune image ni fichier", sorted(sh.keys()) == ["text", "title"] and "data:" not in sh.get("text", "") and "Filaments" in sh.get("text", ""), list(sh.keys()))
    run_axe(pi, "Iris, résultats, thème clair")
    pi.evaluate("document.documentElement.dataset.theme = 'dark'")
    run_axe(pi, "Iris, résultats, thème sombre")
    pi.evaluate("delete document.documentElement.dataset.theme")
    pi.check(".islot[data-i='2'] input[value=G]")
    pi.click("#irisGo")
    attendre(pi, "!!AirDeFamille.iris.state().results", 60000)
    check("Iris (I5) : avertissement si l'on compare un œil gauche et un œil droit", pi.is_visible("#irisEyeWarn"))
    pi.check(".islot[data-i='2'] input[value=D]")
    pi.click("#irisGo")
    attendre(pi, "!document.querySelector('#irisCancel').hidden", 10000)
    pi.check(".islot[data-i='2'] input[value=G]")
    pi.wait_for_timeout(300)
    # Selon la vitesse du poste, la comparaison est interrompue ou vient de finir : dans les deux cas, aucun résultat obsolète.
    pi.wait_for_timeout(1500)
    stt = pi.inner_text("#irisStatus")
    check("Iris (AdF-048) : œil changé pendant la comparaison → aucun résultat obsolète, relance demandée",
          ("interrompue" in stt or "relancez" in stt) and pi.is_hidden("#irisResults") and not pi.evaluate("AirDeFamille.iris.state().results") and not pi.is_disabled("#irisGo"), stt)
    pi.uncheck("#irisAgree")
    check("Iris (R3) : accord décoché → comparaison bloquée", pi.is_disabled("#irisGo"))
    pi.check("#irisAgree")
    # Correction des repères (I2, R7)
    pi.click(".islot[data-i='0'] [data-act=fix]")
    pi.wait_for_selector("#irisFixSheet:not([hidden])")
    noms = [pi.get_attribute(f"#irisFixWrap .hdl[data-h='{h}']", "aria-label") for h in "cpi"]
    vis = [pi.inner_text(f"#irisFixWrap .hdl[data-h='{h}']") for h in "cpi"]
    check("Iris (I2, WCAG 2.5.3) : trois poignées nommées, nom qui commence par le texte visible", noms == ["C, centre de la pupille", "P, bord de la pupille", "I, bord de l'iris"] and all(n.startswith(v) for n, v in zip(noms, vis)), [noms, vis])
    taille = pi.evaluate("[...document.querySelectorAll('#irisFixWrap .hdl')].map(b => b.getBoundingClientRect().width)")
    check("Iris (R7) : poignées d'au moins 24 px", min(taille) >= 24, taille)
    pi.wait_for_timeout(450)
    v0 = pi.inner_text("#irisFixVals")
    pi.focus("#irisFixWrap .hdl[data-h='i']")
    for _ in range(4):
        pi.keyboard.press("Shift+ArrowLeft")
    pi.wait_for_timeout(450)
    v1 = pi.inner_text("#irisFixVals")
    import re as _re
    d0, d1 = (int(_re.search(r"Iris : (\d+) px", v).group(1)) for v in (v0, v1))
    check("Iris (I2) : poignée du bord déplacée au clavier dans le sens de la flèche (vers la gauche = plus grand)", d1 > d0, [v0, v1])
    pi.click("#irisFixSel button[data-sel='p']")
    pi.click("#irisPadSize button[data-size='1']")
    pi.wait_for_timeout(450)
    v2 = pi.inner_text("#irisFixVals")
    check("Iris (R7, WCAG 2.5.7) : poignée réglable par boutons, sans glisser", v2 != v1, [v1, v2])
    band_px = pi.evaluate("(() => { const c = document.querySelector('#irisFixBand'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) n += d[i] + d[i+1] + d[i+2] > 0; return n; })()")
    check("Iris (I2) : aperçu du déroulé mis à jour pendant la correction", band_px > 1000, band_px)
    run_axe(pi, "Iris, correction des repères")
    pi.click("#irisFixAuto")
    pi.wait_for_timeout(300)
    pi.click("#irisFixOk")
    st0 = pi.evaluate("AirDeFamille.iris.state().slots[0]")
    check("Iris (I2) : « Revenir au repérage automatique » rétablit les repères", st0["lm"]["auto"] and abs(st0["lm"]["ri"] - lm["ri"]) < 1, st0["lm"])
    check("Iris : focus rendu au bouton de correction après validation", pi.evaluate("document.activeElement.dataset.act") == "fix")
    # Limites (I1)
    pi.set_input_files(".islot[data-i='1'] input[type=file]", fGris)
    try:
        pi.wait_for_selector("#irisFixSheet:not([hidden])", timeout=20000)
        ouvert = True
    except Exception:
        ouvert = False
    check("Iris (I1) : aucun iris trouvé → message clair et passage direct à la correction", ouvert and "non trouvé" in pi.evaluate("AirDeFamille.iris.state().slots[1].msg"), pi.evaluate("AirDeFamille.iris.state().slots[1].msg"))
    pi.keyboard.press("Escape")
    st1 = pi.evaluate("AirDeFamille.iris.state().slots[1].status")
    check("Iris (AdF-048) : repères non validés → « à corriger », comparaison sans cet iris", st1 == "tofix" and "validez les repères" in pi.inner_text("#irisNeed"), [st1, pi.inner_text("#irisNeed")])
    pi.click(".islot[data-i='1'] [data-act=fix]")
    pi.click("#irisFixOk")
    pi.click("#irisGo")
    attendre(pi, "!!AirDeFamille.iris.state().results", 60000)
    Fg = pi.evaluate("AirDeFamille.iris.state().results[1].F")
    check("Iris (AdF-047) : photo sans motif → motifs « non mesurables », jamais notés", all(Fg[k] is None for k in Fg if k != "clarte_coeur_bord"), Fg)
    pi.set_input_files(".islot[data-i='1'] input[type=file]", fPetit)
    try:
        attendre(pi, "AirDeFamille.iris.state().slots[1].status === 'error'", 20000)
    except TimeoutError:
        pass
    m1 = pi.evaluate("AirDeFamille.iris.state().slots[1].msg")
    check("Iris : iris trop petit (moins de 80 px) refusé avec la raison", "trop petit" in m1, m1)
    # Grande photo (4 000 × 2 400) : l'iris est découpé dans la photo d'origine, à pleine résolution (AdF-058).
    importer(1, fGrand)
    lg = pi.evaluate("AirDeFamille.iris.state().slots[1].lm")
    check("Iris (AdF-058) : grande photo → iris repéré puis découpé à pleine résolution (rayon 300 px, pas 180)", lg and abs(lg["ri"] - 300) / 300 < 0.04 and abs(lg["rp"] - 85) / 85 < 0.06, lg)
    # Grande photo (5 000 × 3 000) avec un petit iris (200 px) : jugé à pleine résolution, accepté et signalé (AdF-062).
    importer(1, fPetitGrand)
    sp = pi.evaluate("AirDeFamille.iris.state().slots[1]")
    check("Iris (AdF-062) : grande photo, petit iris → taille jugée à pleine résolution (rayon 100 px), comparaison à l'œil annoncée",
          sp["status"] == "ready" and sp["lm"] and abs(sp["lm"]["ri"] - 100) / 100 < 0.05 and "moins de 300" in sp["msg"], sp)
    # Chemin manuel sur une grande photo : à la validation, l'iris est redécoupé à pleine résolution (AdF-061).
    importer(1, fGrisGrand, "s.status === 'tofix'")
    ech0 = pi.evaluate("AirDeFamille.iris.state().slots[1].echelle")
    # Fenêtre fermée pendant la découpe : rien n'est appliqué à moitié (image et repères toujours ensemble).
    if pi.is_hidden("#irisFixSheet"):
        pi.click(".islot[data-i='1'] [data-act=fix]")
    pi.click("#irisFixOk")
    pi.keyboard.press("Escape")
    pi.wait_for_timeout(2500)
    sx = pi.evaluate("AirDeFamille.iris.state().slots[1]")
    check("Iris (relecture finale) : fenêtre fermée pendant la découpe → correction abandonnée ou appliquée en entier",
          (sx["status"] == "tofix" and sx["echelle"] == ech0) or (sx["status"] == "ready" and sx["echelle"] > 0.65), sx)
    if pi.is_hidden("#irisFixSheet"):
        pi.click(".islot[data-i='1'] [data-act=fix]")
    pi.click("#irisFixOk")
    attendre(pi, "AirDeFamille.iris.state().slots[1].status === 'ready'", 20000)
    ech1 = pi.evaluate("AirDeFamille.iris.state().slots[1].echelle")
    check("Iris (AdF-061) : repères placés à la main sur une grande photo → découpe refaite dans la photo d'origine", ech0 == 0.6 and ech1 and ech1 > 0.65, [ech0, ech1])
    # Photo pivotée (EXIF) : repérée dans le bon sens.
    importer(1, fPivot)
    lp = pi.evaluate("AirDeFamille.iris.state().slots[1].lm")
    check("Iris : photo pivotée (EXIF Orientation 6) → iris repéré dans le bon sens", lp and abs(lp["cx"] - 450) < 10 and abs(lp["cy"] - 350) < 10 and abs(lp["ri"] - 260) / 260 < 0.04, lp)
    # Iris bleu sur une photo plus large (peau plus claire que l'iris) : repéré (AdF-061).
    importer(1, fBleu)
    lb = pi.evaluate("AirDeFamille.iris.state().slots[1].lm")
    check("Iris (AdF-061) : iris bleu repéré (bord à 4 % près)", lb and abs(lb["ri"] - 260) / 260 < 0.04 and abs(lb["rp"] - 70) / 70 < 0.08, lb)
    # Iris foncé et flou : motifs non mesurés (AdF-061).
    importer(1, fFonceFlou, "s.status === 'ready'")
    pi.click("#irisGo")
    attendre(pi, "!!AirDeFamille.iris.state().results", 60000)
    Ff = pi.evaluate("AirDeFamille.iris.state().results[1].F")
    check("Iris (AdF-061) : iris foncé et flou → motifs « non mesurables »", sum(1 for k in Ff if Ff[k] is None) >= 6, Ff)
    # Collerette claire : jamais prise pour un reflet, mesurée (AdF-061).
    importer(1, fAnneau, "s.status === 'ready'")
    pi.click("#irisGo")
    attendre(pi, "!!AirDeFamille.iris.state().results", 60000)
    Fa = pi.evaluate("AirDeFamille.iris.state().results[1].F")
    check("Iris (AdF-061) : collerette claire mesurée, pas effacée comme un reflet", Fa["collerette"] is not None and Fa["cryptes_densite"] is not None, Fa)
    # Iris de 220 px : un seul avertissement « trop petit », fiches « non mesuré ».
    importer(1, fMoyen, "s.status === 'ready'")
    pi.click("#irisGo")
    attendre(pi, "!!AirDeFamille.iris.state().results", 60000)
    check("Iris (AdF-058) : iris de moins de 300 px → un seul avertissement, fiches « non mesuré (iris trop petit) »",
          pi.is_visible("#irisSmallWarn") and "300" in pi.inner_text("#irisSmallWarn") and "non mesuré (iris trop petit)" in pi.inner_text("#irisTable") and "minimum 300" not in pi.inner_text("#irisTable"), pi.inner_text("#irisSmallWarn"))
    importer(1, fBruit, "s.status === 'ready'")
    pi.click("#irisGo")
    attendre(pi, "!!AirDeFamille.iris.state().results", 60000)
    Fb = pi.evaluate("AirDeFamille.iris.state().results[1].F")
    check("Iris (AdF-054) : iris sans motif mais bruité (téléphone) → motifs « non mesurables »", all(Fb[k] is None for k in Fb if k != "clarte_coeur_bord"), Fb)
    s_av = pi.evaluate("AirDeFamille.iris.state().slots[1]")
    for f, mot in ((os.path.join(FIX, "vide.jpg"), "vide"), (os.path.join(FIX, "texte.jpg"), "illisible")):
        pi.set_input_files(".islot[data-i='1'] input[type=file]", f)
        pi.wait_for_timeout(600)
    tt = pi.inner_text("#toasts").lower()
    check("Iris : fichier vide ou illisible → message, sans erreur", "vide" in tt and ("illisible" in tt or "pas une image" in tt), tt[-200:])
    s_ap = pi.evaluate("AirDeFamille.iris.state().slots[1]")
    check("Iris (AdF-063) : photo illisible → l'emplacement revient à son état d'avant (iris et message gardés)",
          s_ap["status"] == s_av["status"] == "ready" and s_ap["lm"] == s_av["lm"] and s_ap["msg"] == s_av["msg"], [s_av["status"], s_ap["status"], s_ap["msg"]])
    # Base locale (R2)
    pi.click("#tab-album")
    pi.click("#baseEnable")
    attendre(pi, "AirDeFamille.baseState().on", 5000)
    pi.click("#tab-iris")
    pi.click(".islot[data-i='0'] [data-act=keep]")
    pi.wait_for_selector("#irisKeepSheet:not([hidden])")
    bloque = pi.is_disabled("#irisKeepGo")
    pi.check("#irisKeepOk")
    pi.click("#irisKeepGo")
    attendre(pi, "AirDeFamille.baseState().items === 1", 10000)
    item = pi.evaluate("""() => new Promise(ok => { const r = indexedDB.open('adf-base'); r.onsuccess = () => { const t = r.result.transaction('items').objectStore('items').getAll();
      t.onsuccess = () => { const i = t.result[0]; ok({keys: Object.keys(i).sort(), kind: i.kind, eye: i.eye, person: i.person, ro: i.lm.ro.length}); r.result.close(); }; }; })""")
    check("Iris (R2, R3) : accord demandé, puis seuls l'iris recadré et ses repères sont gardés (jamais les mesures)", bloque and item["kind"] == "iris" and item["keys"] == ["added", "eye", "id", "jpeg", "kind", "lm", "person", "ref"] and item["person"] == "Léo", item)
    check("Iris : prénom verrouillé pour un iris gardé", pi.evaluate("document.querySelector(\".islot[data-i='0'] input[data-f=name]\").readOnly"))
    pi.click(".islot[data-i='1'] [data-act=frombase]")
    pi.wait_for_selector("#irisBaseSheet:not([hidden])")
    pi.click("#irisBaseList .ibitem")
    attendre(pi, "AirDeFamille.iris.state().slots[1].status === 'ready' && AirDeFamille.iris.state().slots[1].kept", 10000)
    s1 = pi.evaluate("AirDeFamille.iris.state().slots[1]")
    check("Iris : iris rechargé depuis ma base avec ses repères, sans refaire la correction", s1["eye"] == "D" and "repris" in s1["msg"], s1)
    pi.click(".islot[data-i='1'] [data-act=fix]")
    check("Iris (AdF-062) : iris de la base → pas de « Revenir au repérage automatique » sur l'iris grisé", pi.is_hidden("#irisFixAuto"))
    pi.keyboard.press("Escape")
    # Iris supprimé dans un autre onglet (vraie seconde page) : synchronisation, fenêtre de choix refaite (AdF-054).
    pi.set_input_files(".islot[data-i='2'] input[type=file]", fGris)
    attendre(pi, "AirDeFamille.iris.state().slots[2].status === 'tofix'", 20000)
    if pi.is_visible("#irisFixSheet"):
        pi.keyboard.press("Escape")
    check("Iris (AdF-054) : « Garder » impossible tant que les repères ne sont pas validés", pi.is_hidden(".islot[data-i='2'] [data-act=keep]"))
    pi.uncheck("#irisAgree")
    check("Iris (R3) : « Depuis ma base » bloqué si l'accord est décoché", pi.is_disabled(".islot[data-i='2'] [data-act=frombase]"))
    pi.check("#irisAgree")
    pi.click(".islot[data-i='2'] [data-act=frombase]")
    pi.wait_for_selector("#irisBaseSheet:not([hidden])")
    pj = ctx.new_page()
    pj.goto(base + "index.html#album", wait_until="load")
    attendre(pj, "!!window.AirDeFamille && AirDeFamille.baseState().on", 15000)
    pj.click("#baseManage2")
    pj.wait_for_timeout(400)
    xj = pj.locator("#manageList .mthumb .x").first
    xj.click(); pj.wait_for_timeout(700); xj.click()
    attendre(pj, "AirDeFamille.baseState().items === 0", 5000)
    pj.close()
    try:
        attendre(pi, "AirDeFamille.baseState().items === 0", 5000)
        synchro = True
    except Exception:
        synchro = False
    check("Iris (AdF-049, AdF-054) : suppression dans un autre onglet → base relue, emplacement détaché, fenêtre de choix fermée",
          synchro and not pi.evaluate("AirDeFamille.iris.state().slots[0].kept") and pi.is_hidden("#irisBaseSheet"))
    pi.click(".islot[data-i='0'] [data-act=fix]")
    pi.click("#irisFixSel button[data-sel='p']")
    pi.click("#irisPadSize button[data-size='1']")
    pi.click("#irisFixOk")
    pi.wait_for_timeout(500)
    n_items = pi.evaluate("""() => new Promise(ok => { const r = indexedDB.open('adf-base'); r.onsuccess = () => { const q = r.result.transaction('items').objectStore('items').count();
      q.onsuccess = () => { r.result.close(); ok(q.result); }; }; })""")
    check("Iris (AdF-049) : iris supprimé ailleurs puis corrigé → jamais recréé, emplacement détaché", n_items == 0 and not pi.evaluate("AirDeFamille.iris.state().slots[0].kept"), n_items)
    pi.click(".islot[data-i='0'] [data-act=keep]")
    pi.check("#irisKeepOk"); pi.click("#irisKeepGo")
    attendre(pi, "AirDeFamille.baseState().items === 1", 10000)
    pi.click("#tab-album")
    pi.click("#baseManage2")
    pi.wait_for_timeout(400)
    lab = pi.get_attribute("#manageList .mthumb canvas", "aria-label")
    check("Iris : écran « Ma base » nomme l'iris (« Iris de … »)", lab and lab.startswith("Iris de Léo"), lab)
    x = pi.locator("#manageList .mthumb .x").first
    x.click(); pi.wait_for_timeout(700); x.click()
    attendre(pi, "AirDeFamille.baseState().items === 0", 5000)
    pi.keyboard.press("Escape")
    pi.click("#tab-iris")
    check("Iris : supprimé de la base → l'emplacement n'y est plus rattaché", not any(s["kept"] for s in pi.evaluate("AirDeFamille.iris.state().slots")))
    pi.click("#tab-album"); pi.click("#baseWipe"); pi.wait_for_timeout(700); pi.click("#baseWipe")
    attendre(pi, "!AirDeFamille.baseState().on", 5000)
    pi.click("#tab-iris")
    check("Iris (AdF-059) : essai du selfie retiré, conseils de prise de vue affichés", pi.locator("#irisSelfieBtn").count() == 0 and pi.locator("#irisCamSheet").count() == 0 and "caméra arrière" in pi.text_content("#iris"))
    avant = [s["has"] for s in pi.evaluate("AirDeFamille.iris.state().slots")]
    pi.click("#resetBtn")
    pi.wait_for_timeout(200)
    check("Iris : « Tout effacer » vide aussi les iris", not any(s["has"] for s in pi.evaluate("AirDeFamille.iris.state().slots")))
    pi.locator("#toasts button", has_text="Annuler").first.click()
    pi.wait_for_timeout(300)
    check("Iris : « Annuler » après « Tout effacer » rend les iris", [s["has"] for s in pi.evaluate("AirDeFamille.iris.state().slots")] == avant and any(avant), avant)
    # « Tout effacer » puis « Annuler » pendant l'ouverture d'une grande photo : jamais d'emplacement bloqué.
    pi.set_input_files(".islot[data-i='2'] input[type=file]", fGrand)
    pi.click("#resetBtn")
    pi.locator("#toasts button", has_text="Annuler").first.click()
    try:
        attendre(pi, "AirDeFamille.iris.state().slots.every(s => s.status !== 'busy')", 15000)
    except TimeoutError:
        pass
    so = pi.evaluate("AirDeFamille.iris.state().slots")
    check("Iris (relecture finale) : « Tout effacer » puis « Annuler » pendant l'ouverture → aucun emplacement bloqué",
          all(x["status"] != "busy" for x in so) and not pi.is_disabled(".islot[data-i='2'] [data-act=pick]"), [x["status"] for x in so])
    try:
        viol_i = pi.evaluate("window.__csp || []")
    except Exception:
        viol_i = []
    check("Iris : aucune violation de CSP", not viol_i, viol_i[:5])
    pi.close()

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
