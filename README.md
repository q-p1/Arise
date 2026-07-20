# 🏔️ Arise — من الصفر إلى أرامكو
لعبة RPG تعليمية كاملة: تأسيس ← AWL ← قدرات ← CPC ← وظيفة أرامكو. تعمل أوفلاين وتُثبّت كتطبيق.

## 🚀 النشر على GitHub Pages (نفس طريقة Ventra)
1. أنشئ مستودعًا باسم `arise` وارفع **كل محتويات هذا المجلد** إلى الفرع `main`.
2. Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / `(root)` → Save.
3. بعد دقيقة: `https://<username>.github.io/arise/` — افتحه من الجوال ثم «إضافة إلى الشاشة الرئيسية» وسيعمل أوفلاين بالكامل.

## 📁 البنية
- `index.html` + `assets/app.js` — اللعبة (React مضمّن، ملف واحد مصغّر).
- `manifest.webmanifest` + `sw.js` + `assets/icons/` — PWA وأوفلاين.
- `assets/brand/` — شعار Arise (SVG) + لوحة الهوية.
- `src/` — المحرك + ملفات المحتوى (`content/*.js`) + `build.mjs`.
- `scripts/build-web.sh` — أعد البناء بعد أي إضافة محتوى.

## ➕ إضافة محتوى بلا كود
عدّل/أضف ملفات في `src/content/` (أسئلة، دروس، قوائم AWL) ثم شغّل `scripts/build-web.sh`. التفاصيل في `src/README.md`.

## ملاحظات
- الحفظ محلي على الجهاز (localStorage) — وداخل تطبيق Claude يستخدم تخزين Claude ويرحّل تلقائيًا.
- «المعلم الذكي» (AI) يعمل داخل Claude فقط؛ كل ما عداه يعمل أوفلاين.
