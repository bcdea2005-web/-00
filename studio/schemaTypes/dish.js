export const dish = {
  name: 'dish',
  title: 'الأصناف',
  type: 'document',
  fields: [
    {name: 'title', title: 'اسم الصنف', type: 'string'},
    {name: 'slug', title: 'المعرّف (slug)', type: 'slug', options: {source: 'title'}},
    {name: 'sub', title: 'سطر فرعي قصير', type: 'string'},
    {name: 'description', title: 'الوصف', type: 'text', rows: 4},
    {name: 'price', title: 'السعر (ج.س) — 0 يعني «السعر عند الطلب»', type: 'number'},
    {name: 'category', title: 'القسم', type: 'reference', to: [{type: 'category'}]},
    {
      name: 'image',
      title: 'صورة الصنف',
      type: 'image',
      options: {hotspot: true, metadata: ['dimensions']},
    },
    {
      name: 'extras',
      title: 'إضافات اختيارية',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'extra'}]}],
    },
    {
      name: 'tag',
      title: 'وسم البطاقة',
      type: 'string',
      options: {
        list: [
          {title: 'حار 🔥', value: 'hot'},
          {title: 'طازج', value: 'fresh'},
          {title: 'جديد', value: 'new'},
        ],
      },
    },
    {name: 'spicy', title: 'حار', type: 'boolean', initialValue: false},
    {name: 'available', title: 'متاح للطلب', type: 'boolean', initialValue: true},
    {name: 'order', title: 'الترتيب', type: 'number'},
  ],
  preview: {
    select: {title: 'title', media: 'image', subtitle: 'price'},
    prepare: ({title, media, subtitle}) => ({
      title,
      media,
      subtitle: subtitle ? `${subtitle} ج.س` : 'السعر عند الطلب',
    }),
  },
}
