export const siteSettings = {
  name: 'siteSettings',
  title: 'إعدادات الموقع',
  type: 'document',
  fields: [
    {
      name: 'heroBackground',
      title: 'صورة خلفية الواجهة (Landing Page)',
      description:
        'صورة كبيرة تُعرض كخلفية للصفحة الرئيسية وفوقها لون أحمر خفيف. اتركها فارغة ليظهر شعار المطعم كخلفية افتراضية.',
      type: 'image',
      options: {hotspot: true},
    },
    {name: 'heroTitle', title: 'عنوان الواجهة', type: 'string'},
    {name: 'heroSubtitle', title: 'العنوان الفرعي للواجهة', type: 'string'},
    {name: 'aboutStory', title: 'قصتنا (صفحة من نحن)', type: 'text', rows: 6},
    {name: 'address', title: 'العنوان', type: 'string'},
    {name: 'phone', title: 'رقم الهاتف', type: 'string'},
    {name: 'whatsapp', title: 'رقم واتساب', type: 'string'},
    {
      name: 'tickerMessages',
      title: 'رسائل الشريط المتحرك',
      type: 'array',
      of: [{type: 'string'}],
    },
    {
      name: 'paymentMethods',
      title: 'طرق الدفع',
      type: 'array',
      of: [{type: 'string'}],
    },
    {
      name: 'workingHours',
      title: 'ساعات العمل',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            {name: 'label', title: 'الأيام', type: 'string'},
            {name: 'hours', title: 'الساعات', type: 'string'},
          ],
        },
      ],
    },
  ],
  preview: {
    prepare: () => ({title: 'إعدادات الموقع'}),
  },
}
