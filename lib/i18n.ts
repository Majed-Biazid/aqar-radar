/**
 * Single-source-of-truth dictionary for visible UI strings.
 *
 * Currently Arabic-only. Keys are stable English identifiers; values are the
 * Arabic surface text. The `t()` helper falls back to the key itself if
 * missing — never throws — so partial migration is safe.
 *
 * To add a locale later: turn `dict` into `{ ar: {...}, en: {...} }` and add
 * a setter to switch the active key.
 */

const dict: Record<string, string> = {
  // Brand / masthead
  "brand.tag": "إيجارات الشرقية",
  "brand.subtitle": "رادار العروض النشطة وانخفاضات الأسعار",
  "brand.cities": "الدمام · الخبر · الظهران",

  // Header stats
  "stats.active": "نشطة",
  "stats.new": "جديد",
  "stats.dropped": "انخفض السعر",
  "stats.lastScrape": "آخر تحديث",
  "stats.loading": "جارٍ التحميل…",
  "stats.saved": "محفوظة",

  // View switcher
  "view.split": "قائمة + خريطة",
  "view.list": "قائمة",
  "view.map": "خريطة",

  // Refresh button
  "refresh.idle": "تحديث",
  "refresh.loading": "يحدّث…",

  // Filter
  "filter.title": "تصفية",
  "filter.subtitle": "خصّص ما يظهر لك",
  "filter.districts": "الأحياء",
  "filter.results": "النتائج",
  "filter.reset": "تصفير",
  "filter.tally": "الإجمالي",
  "filter.open": "تصفية",
  "filter.close": "إغلاق",
  "filter.apply": "تطبيق",
  "filter.activeNone": "لا توجد فلاتر مفعّلة",
  "filter.clearAll": "مسح الكل",
  "filter.allDistricts": "كل الأحياء",
  "filter.cityAll": "كل أحياء",

  // Filter actions
  "filter.selectAll": "تحديد الكل",
  "filter.deselectAll": "إلغاء التحديد",

  // Search
  "search.find": "ابحث",
  "search.placeholder": "عنوان · حي · سعر · وصف …",
  "search.clear": "مسح",

  // Filter fields
  "field.price": "السعر",
  "field.age": "العمر",
  "field.sort": "ترتيب",
  "field.gone": "منتهية",

  // Age modes
  "age.new": "جديد",
  "age.le2y": "≤ ٢ سنة",
  "age.any": "الكل",

  // Sort modes
  "sort.priceAsc": "السعر تصاعدي",
  "sort.priceDesc": "السعر تنازلي",
  "sort.newFirst": "جديد أولاً",
  "sort.newest": "الأحدث ظهوراً",
  "sort.areaDesc": "المساحة تنازلي",

  // Switch (gone)
  "switch.show": "إظهار",
  "switch.hide": "إخفاء",

  // Listings section
  "listings.heading": "العروض",
  "listings.of": "من",

  // Card chrome
  "card.aqar": "عقار",
  "card.noPhoto": "لا توجد صورة",
  "card.monthly": "شهري",
  "card.save": "حفظ",
  "card.unsave": "إلغاء الحفظ",
  "card.id": "رقم",

  // Status badges
  "badge.new": "جديد",
  "badge.gone": "منتهية",

  // Detail drawer
  "drawer.recordTag": "سجل",
  "drawer.annual": "سنوي",
  "drawer.monthly": "شهري",
  "drawer.priceHistory": "سجل السعر",
  "drawer.description": "وصف المعلن",
  "drawer.firstSeen": "أول ظهور",
  "drawer.lastSeen": "آخر ظهور",
  "drawer.openAqar": "فتح في موقع عقار",
  "drawer.close": "إغلاق",
  "drawer.specsArea": "المساحة",
  "drawer.specsBeds": "غرف نوم",
  "drawer.specsBaths": "حمّامات",
  "drawer.specsDistrict": "الحي",

  // Empty state
  "empty.title": "لا شيء يطابق معاييرك",
  "empty.body": "وسّع نطاق السعر، حدّد المزيد من الأحياء، أو اضغط تحديث.",

  // Theme toggle
  "theme.toLight": "تبديل إلى الوضع الفاتح",
  "theme.toDark": "تبديل إلى الوضع الداكن",
};

export function t(key: string): string {
  return dict[key] ?? key;
}

/** For places that legitimately need to fall back to a passed default. */
export function tx(key: string, fallback: string): string {
  return dict[key] ?? fallback;
}
