# Bússola Draw — Engenharia Android

Documento completo de engenharia da versão Android: arquitetura de sensores,
instalação nativa (PWA), empacotamento para a Play Store (Capacitor e TWA),
permissões, quirks de fabricantes e roadmap.

---

## 1. Arquitetura em camadas

```
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 3 — Nativo        Capacitor (WebView)  │  TWA       │
├─────────────────────────────────────────────────────────────┤
│  CAMADA 2 — Instalável    PWA manifest + beforeinstallprompt│
│                           service-ready, offline, shortcuts │
├─────────────────────────────────────────────────────────────┤
│  CAMADA 1 — Web Core      React + sensores (este repositório)│
│                           canvas, SVG, spring physics       │
└─────────────────────────────────────────────────────────────┘
```

O núcleo é único: o mesmo binário web (`dist/`) serve o navegador, o app
instalável e o wrapper nativo. Não há fork de código por plataforma.

---

## 2. Motor de sensores (`src/hooks/useCompass.ts`)

Pipeline multi-engine com degradação graciosa — cada engine mais fraca assume
automaticamente se a anterior não entregar dados em 2,5 s (watchdog):

### Engine 1 — Fusão de hardware (Chrome Android ≥ 67)

`AbsoluteOrientationSensor` (Generic Sensor API). É o sensor **fusionado pelo
próprio Android** (acelerômetro + magnetômetro + giroscópio, tipo
`TYPE_ROTATION_VECTOR`), muito mais estável que o magnetômetro cru.

```ts
const sensor = new AbsoluteOrientationSensor({ frequency: 60, referenceFrame: "device" });
// quaternion [x, y, z, w] → azimute (equivalente a SensorManager.getOrientation(R)[0]):
const azimuth = Math.atan2(2 * (x * y - w * z), 1 - 2 * (x * x + z * z));
const heading = ((azimuth * 180) / Math.PI + screenAngle() + 360) % 360;
```

`screenAngle()` compensa a rotação da tela (`screen.orientation.angle`), pois o
azimute é relativo ao eixo físico do aparelho.

### Engine 2 — `deviceorientationabsolute`

Evento absoluto do Chrome Android. `heading = (360 - alpha + screenAngle) % 360`.

### Engine 3 — `deviceorientation` relativo

Aceito apenas se **nenhum** evento absoluto chegou (`sawAbsoluteRef`). Evita a
corrupção do heading por alphas relativos em aparelhos que oferecem ambos.

### Engine 4 — Manual (drag)

Sem sensor (emulador, webview antigo, desktop), o usuário gira a rosa com o dedo.

### Suavização (todas as engines)

Unwrap de ângulo (`+540 % 360 - 180`, sempre o arco mais curto) seguido de mola
criticamente amortecida em `requestAnimationFrame` — o mesmo pipeline suaviza
dados ruidosos e a interação manual.

---

## 3. Instalação nativa sem loja (PWA)

| Recurso | Arquivo | Detalhe |
|---|---|---|
| Instalável | `public/manifest.webmanifest` | `display: standalone`, ícones 192/512 + **maskable** (`icon-maskable.png`, zona segura 80%) |
| Prompt nativo | `src/components/InstallBanner.tsx` | Captura `beforeinstallprompt` → banner "INSTALAR" |
| Direto dos ajustes | `src/components/SettingsSheet.tsx` | Botão **INSTALL NOW** quando o prompt está disponível |
| Atalhos no ícone | manifest `shortcuts` | Long-press abre direto em "Chart Table" (`/?tab=draw`, deep link lido em `App.tsx`) |
| Tela cheia | `isStandalone()` em `src/lib/platform.ts` | Detecta standalone, fullscreen e TWA (`android-app://` referrer) |

Requisitos Android atendidos: HTTPS, manifesto válido, ícone 192+, nome,
`start_url` dentro do `scope`.

---

## 4. Wrapper nativo — Capacitor (Play Store, caminho A)

Empacota `dist/` num WebView nativo. O Chrome WebView moderno entrega
`deviceorientation`/`AbsoluteOrientationSensor` igual ao browser.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init --config capacitor.config.json   # config já existe no repo
npm run build                                  # gera dist/
npx cap add android
npx cap sync
npx cap open android                           # abre no Android Studio
```

### 4.1 Permissões — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-feature android:name="android.hardware.sensor.compass" android:required="false" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

`required="false"` mantém o app instalável em tablets/linha-A sem magnetômetro
(cai no modo manual). Permissões de câmera/localização são solicitadas em
runtime pelo próprio WebView quando o usuário toca em **AR** ou o GPS inicia.

### 4.2 Ícones e splash

```bash
npm install --save-dev @capacitor/assets
npx capacitor-assets generate --android
# lê resources/icon.png, resources/icon-foreground.png, resources/splash.png
```

### 4.3 Plugins recomendados (substituem fallbacks web quando presentes)

```bash
npm install @capacitor/geolocation @capacitor/haptics @capacitor-community/keep-awake
```

O app já degrada para `navigator.vibrate`, Wake Lock API e Geolocation web —
os plugins apenas aumentam fidelidade (ex.: Wake Lock via `FLAG_KEEP_SCREEN_ON`).

---

## 5. Wrapper nativo — TWA / Bubblewrap (Play Store, caminho B)

Trusted Web Activity roda o site em tela cheia via Chrome Custom Tab, sem
WebView embutido. Zero código nativo.

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://SEU-DOMINIO/manifest.webmanifest
bubblewrap build        # gera app-release-signed.aab
```

### 5.1 Digital Asset Links

Edite `public/.well-known/assetlinks.json` com o SHA-256 da sua chave de
assinatura e publique em `https://SEU-DOMINIO/.well-known/assetlinks.json`:

```bash
keytool -list -v -keystore release.keystore -alias SUA_ALIAS \
  | grep 'SHA256:'   # copie o fingerprint para o assetlinks.json
```

Sem esse arquivo, a TWA abre com barra de URL. Com ele, vira janela nativa
totalmente chromeless — incluindo os sensores (o Chrome da TWA é o Chrome real).

---

## 6. Quirks conhecidos do ecossistema Android

| Situação | Comportamento do app |
|---|---|
| Xiaomi/MIUI | "Inicialização automática" desativada mata sensores em segundo plano; o app re-solicita Wake Lock ao voltar ao foco (`visibilitychange`) |
| Samsung Internet | Também entrega `deviceorientationabsolute`; manifesto instalável funciona |
| Sem magnetômetro (Moto E, linha A) | Watchdog → modo manual + chip "DEMO MODE" |
| Tela rotacionada (paisagem) | `screenAngle()` soma 90°/270° ao azimute nas duas engines |
| HTTPS ausente (dev local) | Sensores bloqueados; use `localhost` ou túnel HTTPS |
| Calibração | App exibe "draw a figure-8" quando `webkitCompassAccuracy > 35` ou < 0 (iOS); no Android a fusão de hardware torna drift raro |

---

## 7. Checklist Play Store

- [ ] Build `app-release.aab` (Android App Bundle, obrigatório)
- [ ] `targetSdkVersion` conforme exigência vigente do Google Play
- [ ] Ícone 512 + feature graphic 1024×500 + 2 screenshots por fator de forma
- [ ] Página **Data safety**: declarar localização (precisa, app funcionalidade)
      e câmera (opcional, AR); nada sai do dispositivo
- [ ] Política de permissões: justificar `CAMERA` (modo AR) e `FINE_LOCATION`
      (coordenadas náuticas) no formulário do console
- [ ] `assetlinks.json` publicado se TWA; assinatura via Play App Signing
- [ ] Teste interno com os cenários da seção 8

---

## 8. Matriz de testes

| Cenário | Esperado |
|---|---|
| Chrome Android, segurando p/ Norte | 000°, chip **FUSION LOCK** |
| Girar 360° devagar | Sem saltos (unwrap + mola) |
| Chrome antigo sem Generic Sensor | Cai p/ eventos, chip **LIVE** |
| Emulador sem sensores | **DEMO MODE**, rosa arrastável |
| Instalar via banner | Ícone na home; `standalone`, sem banner de novo |
| Long-press no ícone | Atalhos "Chart Table" e "Compass" |
| GPS + AR negados | Chips de erro amigáveis, bússola segue funcional |
| Avião pousado/rostos metálicos | Declinação: lembrar que heading é magnético |

---

## 9. Roadmap

1. **Norte verdadeiro**: buscar declinação magnética por coordenada (NOAA WMM)
   e adicionar toggle Magnetic/True North com offset visual no mostrador.
2. **Altitude/barômetro** via `Generic Sensor Pressure` onde existir.
3. **Widget de heading** (Jetpack Glance) lendo o mesmo pipeline nativo.
4. **Modo sextante**: câmera AR com retícula e gravação de azimute por foto.
5. Localização PT-BR da interface (strings já centralizáveis no `ANDROID.md`).
