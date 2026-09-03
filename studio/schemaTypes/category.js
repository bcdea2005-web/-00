export const category = {
  name: 'category',
  title: 'أقسام القائمة',
  type: 'document',
  fields: [
    {name: 'title', title: 'اسم القسم', type: 'string'},
    {
      name: 'key',
      title: 'المفتاح (للربط بالموقع)',
      description: 'مثال: meat / fish / salads / soups / juices / hot',
      type: 'string',
    },
    {name: 'icon', title: 'أيقونة', type: 'string'},
    {name: 'order', title: 'الترتيب', type: 'number'},
  ],
  preview: {
    select: {title: 'title'},
  },
}
