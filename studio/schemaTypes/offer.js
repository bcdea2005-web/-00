export const offer = {
  name: 'offer',
  title: 'العروض الخاصة',
  type: 'document',
  fields: [
    {name: 'title', title: 'اسم العرض', type: 'string'},
    {name: 'badge', title: 'الشارة (مثال: عرض اليوم)', type: 'string'},
    {
      name: 'items',
      title: 'ما يشمله العرض',
      type: 'array',
      of: [{type: 'string'}],
    },
    {name: 'price', title: 'سعر العرض (ج.س)', type: 'number'},
    {name: 'originalPrice', title: 'السعر قبل الخصم (ج.س)', type: 'number'},
    {name: 'image', title: 'صورة العرض', type: 'image', options: {hotspot: true}},
    {name: 'active', title: 'مفعّل', type: 'boolean', initialValue: true},
  ],
  preview: {
    select: {title: 'title', subtitle: 'badge', media: 'image'},
  },
}
