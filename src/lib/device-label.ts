/** Tên thiết bị dễ đọc từ User-Agent, vd "iPhone · Safari", "Windows · Chrome". */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return 'Thiết bị không rõ'

  let os = 'Thiết bị khác'
  if (/iPhone/i.test(ua)) os = 'iPhone'
  else if (/iPad/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua))) os = 'iPad'
  else if (/Android/i.test(ua)) {
    const model = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\sBuild|\))/i)?.[1]?.trim()
    os = model && !/^(K|wv|Linux)$/i.test(model) ? `Android (${model})` : 'Android'
  } else if (/Windows/i.test(ua)) os = 'Windows'
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'Mac'
  else if (/CrOS/i.test(ua)) os = 'Chromebook'
  else if (/Linux/i.test(ua)) os = 'Linux'

  let browser = 'Trình duyệt'
  if (/Zalo/i.test(ua)) browser = 'Zalo'
  else if (/FBAN|FBAV|FB_IAB/i.test(ua)) browser = 'Facebook'
  else if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera'
  else if (/CocCoc|coc_coc/i.test(ua)) browser = 'Cốc Cốc'
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet'
  else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox'
  else if (/CriOS|Chrome/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua)) browser = 'Safari'

  return `${os} · ${browser}`
}
