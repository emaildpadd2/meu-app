# Instalação — Bússola Draw (Android)

Quatro caminhos, do mais rápido ao mais completo. O app **não precisa de APK**
para rodar full-screen no Android (Opção A), mas se você quiser o binário
`.apk`, as opções B, C e D o geram.

---

## A. Sem APK — instalar direto do navegador (≈ 2 min)

1. Faça deploy da pasta `dist/` em qualquer host HTTPS (Netlify Drop, Vercel,
   GitHub Pages, Cloudflare Pages — todos gratuitos):
   ```bash
   npm run build        # gera dist/
   npx netlify deploy --dir=dist --prod
   # ou:  npx vercel deploy dist --prod
   ```
2. No Android, abra a URL no **Chrome**.
3. O app mostra um banner **"Instalar Bússola Draw"** → toque em **INSTALL**.
   (Ou menu ⋮ → **Instalar app** / **Adicionar à tela inicial**.)

Pronto: ícone na tela inicial, full-screen, atalhos long-press (Bússola /
Chart Table) e sensores de hardware funcionando — sem APK, sem loja.

---

## B. APK pelo PWABuilder (sem instalar nada no PC)

1. Faça o deploy da Opção A (precisa de uma URL HTTPS pública).
2. Acesse **https://www.pwabuilder.com** e cole a URL do app.
3. Clique em **Package for Android** → **Download Package**.
4. O `.zip` traz o **APK** (para testar direto) e o **AAB** (para a Play Store),
   já assinados por ele. O site também mostra o fingerprint SHA-256 para colar
   em `public/.well-known/assetlinks.json` se quiser a TWA perfeita.

---

## C. APK automático no GitHub (sem instalar nada no PC)

Este repositório já inclui **`.github/workflows/android-apk.yml`**:

1. Suba o projeto para um repositório no GitHub:
   ```bash
   git init && git add -A && git commit -m "Bússola Draw"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/bussola-draw.git
   git push -u origin main
   ```
2. No GitHub: aba **Actions** → workflow **Android APK** → aguarde (~5–8 min).
3. Em **Artifacts**, baixe **`bussola-draw-apk`** → dentro está
   `app-debug.apk`.

O workflow instala Node + JDK + Android SDK, compila o `dist/`, cria o projeto
nativo com Capacitor e monta o APK sozinho. É debug (assinatura de teste) —
instala em qualquer Android; para Play Store, use release assinado (ver D e
`ANDROID.md`).

---

## D. APK no seu PC (Capacitor + Android Studio)

Pré-requisitos: JDK 17+ e Android Studio (com SDK 35).

```bash
npm install
npm run build
npm install -D @capacitor/core @capacitor/cli @capacitor/android
npx cap add android          # cria a pasta android/
npx cap sync android
```

**Pela interface:** `npx cap open android` → no Android Studio,
**Build → Build App Bundle(s)/APK(s) → Build APK(s)** →
`android/app/build/outputs/apk/debug/app-debug.apk`.

**Pela linha de comando:**
```bash
cd android && ./gradlew assembleDebug
```

**Release assinado (Play Store):** gere a keystore e assine —
```bash
keytool -genkey -v -keystore bussola.keystore -alias bussola \
  -keyalg RSA -keysize 2048 -validity 10000
cd android && ./gradlew assembleRelease   # configure signing no build.gradle
```
Detalhes completos de permissões, ícones adaptativos e checklist da loja:
ver **`ANDROID.md`** (seções 4 e 7).

---

## Instalando o APK no celular

1. Copie o `.apk` para o Android (cabo, Drive, Telegram — o que preferir).
2. Toque no arquivo → permita **"instalar apps desconhecidos"** para o
   gerenciador de arquivos/navegador usado (solicitação do próprio Android).
3. Abra o app: conceda **sensores de movimento**, **localização** (GPS) e
   **câmera** (modo AR) quando pedido. O chip deve exibir **FUSION LOCK**.

> O APK debug avisa "fonte desconhecida" na primeira instalação — normal para
> apps fora da Play Store. Para distribuir publicamente, publique o AAB na
> Play Console (`ANDROID.md`, seção 7).
