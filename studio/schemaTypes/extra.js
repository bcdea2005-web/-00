export const extra = {
  name: 'extra',
  title: 'الإضافات',
  type: 'document',
  fields: [
    {name: 'name', title: 'اسم الإضافة', type: 'string'},
    {name: 'price', title: 'السعر (ج.س) — 0 تعني مجانية', type: 'number'},
  ],
  preview: {
    select: {title: 'name', subtitle: 'price'},
  },
}
