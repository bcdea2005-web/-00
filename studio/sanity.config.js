import {defineConfig} from 'sanity'
import {structureTool} from 'sanity/structure'
import {visionTool} from '@sanity/vision'
import {schemaTypes} from './schemaTypes'

/**
 * إعدادات الموقع (siteSettings) مستند مفرد (Singleton):
 *  - اللوحة تفتح دائماً المستند نفسه بالمعرّف الثابت `siteSettings` —
 *    نفس المستند الذي يقرأه الموقع — فلا يحدث تضارب «تعديل مستند والموقع يقرأ غيره».
 *    (هذا كان سبب مشكلة: تغيير الخلفية من اللوحة لا يظهر في الموقع،
 *    لأنه وُجد مستندان siteSettings والموقع كان يقرأ الأقدم منهما.)
 *  - يُمنع إنشاء مستند إعدادات ثانٍ من قائمة «+» ومن إجراء «تكرار».
 */
const SINGLETON_SETTINGS_ID = 'siteSettings'

const structure = (S) =>
  S.list()
    .title('المحتوى')
    .items([
      S.listItem()
        .title('إعدادات الموقع')
        .child(
          S.document().schemaType('siteSettings').documentId(SINGLETON_SETTINGS_ID).title('إعدادات الموقع'),
        ),
      ...S.documentTypeListItems().filter((item) => item.getId() !== 'siteSettings'),
    ])

export default defineConfig({
  name: 'mashwi',
  title: 'مشوي للأسماك واللحوم — لوحة التحكم',
  projectId: '197665fs',
  dataset: 'production',
  plugins: [structureTool({structure}), visionTool()],
  document: {
    // منع إنشاء مستند siteSettings جديد من قائمة «+» العامة (المستند مفرد)
    newDocumentOptions: (prev, {creationContext}) =>
      creationContext.type === 'global'
        ? prev.filter((item) => item.templateId !== 'siteSettings')
        : prev,
    // إخفاء إجراءات تُفسد المستند المفرد: تكرار / حذف / إلغاء النشر
    actions: (prev, {schemaType}) =>
      schemaType === 'siteSettings'
        ? prev.filter(({action}) => action !== 'duplicate' && action !== 'delete' && action !== 'unpublish')
        : prev,
  },
  schema: {
    types: schemaTypes,
  },
})
