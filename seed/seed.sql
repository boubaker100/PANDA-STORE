-- Algerian E-Commerce Demo Data
INSERT OR IGNORE INTO settings (
  id, name, tagline, logo_key, color, currency,
  default_home_delivery_fee, default_desk_delivery_fee, free_shipping_over,
  announcement, whatsapp, transfer_info, is_open
)
VALUES (
  1,
  'متجر الجزائر الإلكتروني',
  'تسوق أفضل المنتجات مع التوصيل السريع لـ 69 ولاية والدفع عند الاستلام',
  '/brand/mark.svg',
  '#1b6b44',
  'د.ج',
  600,
  350,
  10000,
  'توصيل سريع لجميع الولايات الـ 69 • الدفع عند الاستلام أو عبر بريدي موب',
  '0669883179',
  'الدفع عبر تطبيق بريدي موب (BaridiMob) أو CCP:
RIP: 00799999000123456789999
باسم: متجر الجزائر
يرجى إرفاق صورة وصل التحويل عند إتمام الطلب.',
  1
);

INSERT OR IGNORE INTO categories (id, name, image_key, sort) VALUES
  (1, 'إلكترونيات وساعات', '/demo/cat-tools.svg', 0),
  (2, 'أحذية وملابس رياضية', '/demo/cat-saudi.svg', 1),
  (3, 'حقائب وإكسسوارات', '/demo/cat-gifts.svg', 2),
  (4, 'المنزل والمطبخ', '/demo/cat-beans.svg', 3);

INSERT OR IGNORE INTO products (
  id, category_id, name, description, price, old_price, images, video_url, variants, sections, available, sort
) VALUES
  (
    1,
    1,
    'ساعة ذكية رياضية مقاومة للماء Ultra Smart Watch',
    'ساعة الجيل الجديد بشاشة AMOLED فائقة الوضوح، تدعم المكالمات وقياس نبضات القلب ونسبة الأكسجين، وبطارية تدوم حتى 7 أيام.',
    4500,
    5900,
    '["/demo/grinder.svg", "/demo/v60.svg"]',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    '{"colors":[{"name":"أسود ملكي","hex":"#18181b"},{"name":"فضي تيتانيوم","hex":"#e4e4e7"},{"name":"برتقالي رياضي","hex":"#f97316"}],"sizes":["49 مم"]}',
    '[{"id":"sec_feat","type":"features","title":"أهم المميزات","enabled":true,"content":{"items":["شاشة AMOLED ساطعة بدقة فائقة 2.02 بوصة","مقاومة للماء والتعرق بمعيار IP68","إجراء واستقبال المكالمات بوضوح تام عبر البلوتوث","مراقبة ضغط الدم ونبضات القلب ومستوى النوم على مدار 24 ساعة"]}},{"id":"sec_specs","type":"specs","title":"المواصفات الفنية","enabled":true,"content":{"items":[{"label":"سعة البطارية","value":"380 مللي أمبير"},{"label":"مدة الشحن","value":"ساعتان عبر الشاحن اللاسلكي"},{"label":"التوافق","value":"أندرويد و آيفون (iOS)"},{"label":"مادة الهيكل","value":"سبائك الزنك والتيتانيوم"}]}},{"id":"sec_faq","type":"faq","title":"الأسئلة الشائعة","enabled":true,"content":{"items":[{"q":"هل الساعة تدعم اللغة العربية بالكامل؟","a":"نعم، تدعم اللغة العربية في القوائم والإشعارات والرسائل."},{"q":"كم يستغرق التوصيل؟","a":"التوصيل خلال 24 إلى 48 ساعة لمعظم الولايات."}]}}]',
    1,
    0
  ),
  (
    2,
    2,
    'حذاء رياضي هوائي مريح للمشي والجري Air Run Pro',
    'تصميم عصري فائق الخفة بنعل هوائي مضاد للصدمات، نسيج مسامي يسمح بتهوية القدم وراحة طوال اليوم أثناء المشي والعمل.',
    3800,
    4900,
    '["/demo/bag-colombia.svg"]',
    '',
    '{"colors":[{"name":"أسود كلاسيك","hex":"#09090b"},{"name":"رمادي داكن","hex":"#52525b"},{"name":"أبيض ناصع","hex":"#fafafa"}],"sizes":["40","41","42","43","44","45"]}',
    '[{"id":"sec_feat","type":"features","title":"مميزات الحذاء","enabled":true,"content":{"items":["نعل هوائي مرن يمتص الصدمات ويقلل إجهاد الركبة والظهر","نسيج مسامي شبكي يسمح بمرور الهواء ويمنع الروائح","خفيف الوزن جداً مناسب للدوام والمشي الطويل"]}}]',
    1,
    1
  ),
  (
    3,
    1,
    'سماعات لاسلكية عازلة للضوضاء Wireless Earbuds Pro',
    'صوت نقي محيطي بتقنية عزل الضوضاء النشطة ANC، ميكروفون مزدوج للمكالمات الواضحة وعلبة شحن تكفي لـ 30 ساعة استخدام.',
    2900,
    3900,
    '["/demo/filters.svg"]',
    '',
    '{"colors":[{"name":"أبيض لؤلؤي","hex":"#ffffff"},{"name":"أسود مطفي","hex":"#18181b"}],"sizes":[]}',
    '[{"id":"sec_specs","type":"specs","title":"المواصفات","enabled":true,"content":{"items":[{"label":"إصدار البلوتوث","value":"Bluetooth 5.3"},{"label":"عمر البطارية","value":"6 ساعات متواصلة و 30 ساعة مع العلبة"},{"label":"منفذ الشحن","value":"Type-C سريع"}]}}]',
    1,
    2
  ),
  (
    4,
    3,
    'حقيبة ظهر ذكية مقاومة للماء مع منفذ شحن USB',
    'حقيبة أنيقة للعمل والسفر وحمل الكمبيوتر المحمول حتى 15.6 بوصة، جيوب سرية مضادة للسرقة وقماش مقاوم للماء والتمزق.',
    3200,
    4200,
    '["/demo/bag-brazil.svg"]',
    '',
    '{"colors":[{"name":"رمادي أنيق","hex":"#4b5563"},{"name":"أسود فخم","hex":"#111827"},{"name":"أزرق داكن","hex":"#1e3a8a"}],"sizes":[]}',
    '[]',
    1,
    3
  );

INSERT OR IGNORE INTO banners (id, image_key, title, subtitle, button_text, link, sort) VALUES
  (1, '/demo/banner-roast.svg', 'عروض التوصيل لـ 69 ولاية', 'اطلب الآن وادفع براحتك عند الاستلام بعد المعاينة', 'تسوّق الآن', '/p/1', 0),
  (2, '/demo/banner-saudi.svg', 'الساعة الذكية الأكثر طلباً', 'مقاومة للماء، مكالمات، وبطارية أسبوع كامل بخصم خاص', 'اكتشف العرض', '/p/1', 1),
  (3, '/demo/banner-gift.svg', 'أحذية المشي المريحة بخصم 22%', 'تصميم هوائي مريح لأيام العمل والمشي الطويل', 'اطلب مقاسك', '/p/2', 2);

-- Sample delivery rates for major Wilayas (owner can customize from admin dashboard)
INSERT OR IGNORE INTO delivery_rates (id, wilaya_id, wilaya_name, home_fee, desk_fee, is_available) VALUES
  (1, 16, 'الجزائر العاصمة', 450, 300, 1),
  (2, 31, 'وهران', 550, 350, 1),
  (3, 25, 'قسنطينة', 550, 350, 1),
  (4, 19, 'سطيف', 500, 350, 1),
  (5, 9, 'البليدة', 450, 300, 1),
  (6, 35, 'بومرداس', 450, 300, 1),
  (7, 23, 'عنابة', 600, 400, 1),
  (8, 13, 'تلمسان', 600, 400, 1),
  (9, 30, 'ورقلة', 800, 500, 1),
  (10, 47, 'غرداية', 800, 500, 1);
