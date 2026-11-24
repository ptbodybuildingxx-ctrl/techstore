# TechStore 6.3 — Business Pro

نظام متجر وإدارة محل إلكترونيات، عربي/إنجليزي، بواجهتي الحاسوب والموبايل.

**[الموقع المنشور](https://ptbodybuildingxx-ctrl.github.io/techstore/workspace.html)** · [دليل الصيانة](docs/MAINTENANCE.md) · [إصدار 6.3](docs/releases/v6.3.md) · [سجل الإصدارات](docs/releases/README.md) · [الأمان](SECURITY.md)

## هيكل المشروع

- `workspace.html`, `workspace.js`, `workspace.css`: واجهة العمل السحابية الأساسية.
- `modules/`: وحدات مستقلة حسب الوظيفة.
- `supabase-client.js`: الاتصال بالمصادقة وواجهات Supabase.
- `supabase/functions/`: الوظائف الخلفية المنشورة.
- `supabase/migrations/`: تغييرات قاعدة البيانات بالترتيب التاريخي.
- `tests/`: الاختبارات البرمجية.
- `docs/`: التوثيق، الإصدارات السابقة، وتعديلات الخلفية غير المنشورة.
- `sw.js`, `manifest.webmanifest`, `icon-*.png`: PWA.
- `index.html`, `app.js`, `owner.js`, `extension.js`, `bridge.js`, `style.css`: واجهة قديمة/تجريبية، ليست بديلًا آمنًا عن السحابة.
- `server.mjs`, `Dockerfile`, `render.yaml`: خادم محلي/بديل SQLite، لا يضم جميع خصائص Supabase الحديثة.

## اختبار الكود

Node.js 24:
```sh
npm run check
npm test
```

للتجربة المحلية للواجهة السحابية: استخدم خادم ملفات ثابتة على localhost:8080 وافتح workspace.html. الاتصال بمشروع Supabase الحقيقي يحتاج حسابًا مصرحًا له؛ لا تستخدم بيانات تجريبية في قاعدة الإنتاج. الخادم المحلي `npm start` يخص المسارات القديمة/SQLite.

## حدود التشغيل

لا تعتبر النظام نظامًا محاسبيًا معتمدًا أو خاليًا من الثغرات. اقرأ ملاحظات الإصدار ودليل الأمان قبل إدخال بيانات مالية أو بيانات عملاء فعلية. لا تضع أسرارًا أو نسخًا احتياطية أو بيانات عملاء في هذا المستودع العام.
