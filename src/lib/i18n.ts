/**
 * Map user's native language name (e.g. "Danish") to 2-letter code for API (e.g. "da").
 */
const LANGUAGE_NAME_TO_CODE: Record<string, string> = {
  danish: "da",
  swedish: "sv",
  russian: "ru",
  bengali: "bn",
  polish: "pl",
  norwegian: "no",
  lithuanian: "lt",
  hindi: "hi",
  french: "fr",
  german: "de",
  english: "en",
  spanish: "es",
  italian: "it",
  portuguese: "pt",
  dutch: "nl",
  arabic: "ar",
  urdu: "ur",
  chinese: "zh",
  japanese: "ja",
  korean: "ko",
};

export function nativeLanguageToCode(name: string): string {
  const key = name.trim().toLowerCase();
  return LANGUAGE_NAME_TO_CODE[key] ?? (key.slice(0, 2) || "en");
}

/** Map native language name to our subtitle file slug (e.g. "Danish" -> "danish"). Returns null if unknown. */
export function nativeLanguageToSubtitleSlug(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (key in LANGUAGE_NAME_TO_CODE) return key;
  if (!key) return null;
  return key.replace(/\s+/g, "-");
}

type UiStrings = {
  logOut: string;
  backToMovies: string;
  letsGo: string;
  watchVideo: string;
  downloadSubtitles: string;
  loadingMovie: string;
  watchWithSubtitles: (lang: string) => string;
};

const UI: Record<string, UiStrings> = {
  en: {
    logOut: "Log out",
    backToMovies: "Back to movies",
    letsGo: "Let's go!",
    watchVideo: "Watch video",
    downloadSubtitles: "Download subtitles",
    loadingMovie: "Loading movie… get the popcorn!",
    watchWithSubtitles: (lang) => `Watch with ${lang} subtitles`,
  },
  da: {
    logOut: "Log ud",
    backToMovies: "Tilbage til film",
    letsGo: "Lad os gå!",
    watchVideo: "Se video",
    downloadSubtitles: "Download undertekster",
    loadingMovie: "Indlæser film… hent popcorn!",
    watchWithSubtitles: (lang) => `Se med ${lang} undertekster`,
  },
  sv: {
    logOut: "Logga ut",
    backToMovies: "Tillbaka till filmer",
    letsGo: "Nu kör vi!",
    watchVideo: "Titta på video",
    downloadSubtitles: "Ladda ner undertexter",
    loadingMovie: "Laddar film… hämta popcorn!",
    watchWithSubtitles: (lang) => `Titta med ${lang} undertexter`,
  },
  ru: {
    logOut: "Выйти",
    backToMovies: "Назад к фильмам",
    letsGo: "Поехали!",
    watchVideo: "Смотреть видео",
    downloadSubtitles: "Скачать субтитры",
    loadingMovie: "Загрузка фильма… достаньте попкорн!",
    watchWithSubtitles: (lang) => `Смотреть с субтитрами на ${lang}`,
  },
  bn: {
    logOut: "লগআউট",
    backToMovies: "সিনেমায় ফিরে যান",
    letsGo: "চলো!",
    watchVideo: "ভিডিও দেখুন",
    downloadSubtitles: "সাবটাইটেল ডাউনলোড করুন",
    loadingMovie: "সিনেমা লোড হচ্ছে… পপকর্ন নিয়ে আসুন!",
    watchWithSubtitles: (lang) => `${lang} সাবটাইটেল সহ দেখুন`,
  },
  pl: {
    logOut: "Wyloguj",
    backToMovies: "Powrót do filmów",
    letsGo: "Jazda!",
    watchVideo: "Obejrzyj film",
    downloadSubtitles: "Pobierz napisy",
    loadingMovie: "Ładowanie filmu… przygotuj popcorn!",
    watchWithSubtitles: (lang) => `Obejrzyj z napisami po ${lang}`,
  },
  no: {
    logOut: "Logg ut",
    backToMovies: "Tilbake til filmer",
    letsGo: "La oss gå!",
    watchVideo: "Se video",
    downloadSubtitles: "Last ned undertekster",
    loadingMovie: "Laster film… hent popcorn!",
    watchWithSubtitles: (lang) => `Se med ${lang} undertekster`,
  },
  lt: {
    logOut: "Atsijungti",
    backToMovies: "Atgal į filmus",
    letsGo: "Pirmyn!",
    watchVideo: "Žiūrėti vaizdo įrašą",
    downloadSubtitles: "Atsisiųsti subtitrus",
    loadingMovie: "Kraunamas filmas… paruoškite popkorną!",
    watchWithSubtitles: (lang) => `Žiūrėti su ${lang} subtitrais`,
  },
  hi: {
    logOut: "लॉग आउट",
    backToMovies: "फिल्मों पर वापस जाएं",
    letsGo: "चलो चलें!",
    watchVideo: "वीडियो देखें",
    downloadSubtitles: "उपशीर्षक डाउनलोड करें",
    loadingMovie: "फिल्म लोड हो रही है… पॉपकॉर्न ले आइए!",
    watchWithSubtitles: (lang) => `${lang} उपशीर्षक के साथ देखें`,
  },
  fr: {
    logOut: "Déconnexion",
    backToMovies: "Retour aux films",
    letsGo: "C'est parti !",
    watchVideo: "Regarder la vidéo",
    downloadSubtitles: "Télécharger les sous-titres",
    loadingMovie: "Chargement du film… préparez le popcorn !",
    watchWithSubtitles: (lang) => `Voir avec sous-titres ${lang}`,
  },
  de: {
    logOut: "Abmelden",
    backToMovies: "Zurück zu den Filmen",
    letsGo: "Los geht's!",
    watchVideo: "Video ansehen",
    downloadSubtitles: "Untertitel herunterladen",
    loadingMovie: "Film wird geladen… hol das Popcorn!",
    watchWithSubtitles: (lang) => `Ansehen mit ${lang} Untertiteln`,
  },
  es: {
    logOut: "Cerrar sesión",
    backToMovies: "Volver a películas",
    letsGo: "¡Vamos!",
    watchVideo: "Ver video",
    downloadSubtitles: "Descargar subtítulos",
    loadingMovie: "Cargando película… ¡consigue las palomitas!",
    watchWithSubtitles: (lang) => `Ver con subtítulos en ${lang}`,
  },
  it: {
    logOut: "Esci",
    backToMovies: "Torna ai film",
    letsGo: "Andiamo!",
    watchVideo: "Guarda video",
    downloadSubtitles: "Scarica i sottotitoli",
    loadingMovie: "Caricamento film… prendi i popcorn!",
    watchWithSubtitles: (lang) => `Guarda con sottotitoli in ${lang}`,
  },
  pt: {
    logOut: "Sair",
    backToMovies: "Voltar aos filmes",
    letsGo: "Vamos lá!",
    watchVideo: "Assistir vídeo",
    downloadSubtitles: "Baixar legendas",
    loadingMovie: "Carregando filme… pegue a pipoca!",
    watchWithSubtitles: (lang) => `Assistir com legendas em ${lang}`,
  },
  zh: {
    logOut: "退出",
    backToMovies: "返回电影",
    letsGo: "走吧！",
    watchVideo: "观看视频",
    downloadSubtitles: "下载字幕",
    loadingMovie: "加载电影中… 准备好爆米花！",
    watchWithSubtitles: (lang) => `使用${lang}字幕观看`,
  },
  ja: {
    logOut: "ログアウト",
    backToMovies: "映画に戻る",
    letsGo: "行こう！",
    watchVideo: "動画を見る",
    downloadSubtitles: "字幕をダウンロード",
    loadingMovie: "映画を読み込み中… ポップコーンを用意して！",
    watchWithSubtitles: (lang) => `${lang}字幕で見る`,
  },
  ko: {
    logOut: "로그아웃",
    backToMovies: "영화로 돌아가기",
    letsGo: "가자!",
    watchVideo: "동영상 보기",
    downloadSubtitles: "자막 다운로드",
    loadingMovie: "영화 로딩 중… 팝콘 준비하세요!",
    watchWithSubtitles: (lang) => `${lang} 자막으로 보기`,
  },
  ar: {
    logOut: "تسجيل الخروج",
    backToMovies: "العودة إلى الأفلام",
    letsGo: "هيا بنا!",
    watchVideo: "شاهد الفيديو",
    downloadSubtitles: "تحميل الترجمة",
    loadingMovie: "جاري تحميل الفيلم… جهّز الفشار!",
    watchWithSubtitles: (lang) => `شاهد مع ترجمة ${lang}`,
  },
};

export function getUiStrings(langCode: string): UiStrings {
  const c = langCode.trim().toLowerCase().slice(0, 2);
  return UI[c] ?? UI.en;
}
