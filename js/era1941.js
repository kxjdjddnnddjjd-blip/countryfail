// Мир на 22 июня 1941 года: границы, оккупация, флаги, лидеры, союзы и войны
window.ERA1941 = (() => {
  // ---------- рисованные флаги эпохи (без нацистской символики — как в HOI4) ----------
  function draw(spec) {
    const cv = document.createElement('canvas'); cv.width = 150; cv.height = 100;
    const g = cv.getContext('2d');
    const { t, c = [], e, ec = '#fff' } = spec;
    if (t === 'h') { const k = spec.k || c.map(() => 1), s = k.reduce((a, b) => a + b, 0); let y = 0; c.forEach((col, i) => { g.fillStyle = col; const h = 100 * k[i] / s; g.fillRect(0, y, 150, h + 1); y += h; }); }
    else if (t === 'v') c.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 150 / c.length, 0, 150 / c.length + 1, 100); });
    else { g.fillStyle = c[0]; g.fillRect(0, 0, 150, 100); }
    const star = (cx, cy, R, col) => { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? R * 0.42 : R; g.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } g.fill(); };
    const glyph = (s, x, y, size, col) => { g.fillStyle = col; g.font = `bold ${size}px "Segoe UI Symbol", "Segoe UI", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y); };
    if (e === 'sickle') { glyph('☭', 30, 36, 30, '#ffd700'); star(30, 13, 6, '#ffd700'); }
    if (e === 'star') star(75, 50, 18, ec);
    if (e === 'disc') { g.fillStyle = ec; g.beginPath(); g.arc(75, 50, 16, 0, 7); g.fill(); }
    if (e === 'cross') { g.fillStyle = '#c8102e'; g.fillRect(63, 36, 24, 28); g.fillStyle = '#fff'; g.fillRect(73, 39, 4, 22); g.fillRect(66, 47, 18, 5); }
    if (e === 'lorraine') glyph('☨', 75, 52, 46, '#c8102e');
    if (e === 'check') { for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) { g.fillStyle = (x + y) % 2 ? '#fff' : '#c8102e'; g.fillRect(66 + x * 6, 36 + y * 7, 6, 7); } }
    if (e === 'dblcross') { g.fillStyle = '#c8102e'; g.fillRect(61, 30, 28, 40); g.fillStyle = '#fff'; g.fillRect(73, 34, 4, 32); g.fillRect(65, 41, 20, 4); g.fillRect(63, 51, 24, 4); }
    if (e === 'roc' || e === 'rocpeace') { // флаг Китайской Республики (и он же у режима Ван Цзинвэя — с вымпелом)
      g.fillStyle = '#c8102e'; g.fillRect(0, 0, 150, 100); g.fillStyle = '#000095'; g.fillRect(0, 0, 75, 50);
      g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, r = i % 2 ? 10 : 19; g.lineTo(37 + r * Math.cos(a), 25 + r * Math.sin(a)); } g.fill();
      g.fillStyle = '#000095'; g.beginPath(); g.arc(37, 25, 9, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(37, 25, 7.5, 0, 7); g.fill();
      if (e === 'rocpeace') { g.fillStyle = '#ffd200'; g.beginPath(); g.moveTo(75, 0); g.lineTo(150, 0); g.lineTo(150, 14); g.lineTo(75, 14); g.fill(); }
    }
    if (e === 'manchu') { g.fillStyle = '#ffd200'; g.fillRect(0, 0, 150, 100); ['#c8102e', '#00247d', '#fff', '#000'].forEach((col, i) => { g.fillStyle = col; g.fillRect(0, i * 12.5, 50, 12.5); }); }
    if (e === 'ensign') { // красный/синий кормовой флаг с британским крыжем
      g.fillStyle = '#00247d'; g.fillRect(0, 0, 66, 50);
      g.strokeStyle = '#fff'; g.lineWidth = 9; g.beginPath(); g.moveTo(0, 0); g.lineTo(66, 50); g.moveTo(66, 0); g.lineTo(0, 50); g.stroke();
      g.strokeStyle = '#c8102e'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#fff'; g.fillRect(26, 0, 14, 50); g.fillRect(0, 18, 66, 14);
      g.fillStyle = '#c8102e'; g.fillRect(29, 0, 8, 50); g.fillRect(0, 21, 66, 8);
      g.fillStyle = '#e8d9a0'; g.fillRect(105, 38, 20, 24);
    }
    if (e === 'iraq') { g.fillStyle = '#c8102e'; g.beginPath(); g.moveTo(0, 0); g.lineTo(40, 25); g.lineTo(40, 75); g.lineTo(0, 100); g.fill(); star(14, 40, 7, '#fff'); star(14, 60, 7, '#fff'); }
    if (e === 'egypt') { g.fillStyle = '#fff'; g.beginPath(); g.arc(70, 50, 26, 0, 7); g.fill(); g.fillStyle = c[0]; g.beginPath(); g.arc(79, 50, 22, 0, 7); g.fill(); star(78, 36, 6, '#fff'); star(86, 50, 6, '#fff'); star(78, 64, 6, '#fff'); }
    if (e === 'tuva') { g.fillStyle = '#ffd200'; g.beginPath(); g.moveTo(0, 0); g.lineTo(55, 50); g.lineTo(0, 100); g.fill(); g.fillStyle = '#fff'; g.fillRect(55, 0, 95, 100); g.fillStyle = '#1e50a0'; g.fillRect(55, 0, 95, 33); g.fillRect(55, 67, 95, 33); }
    return cv.toDataURL();
  }

  // ---------- государства: [название, цвет, флаг, лидер, валюта, сила армии, ВВП млрд $, столица] ----------
  const S = (name, color, flag, leader, currency, power, gdp, capital) => ({ name, color, flag, leader, currency, power, gdp, capital });
  const countries = {
    DE: S('Германский рейх', '#5a5f63', { t: 'h', c: ['#111', '#fff', '#d00'] }, 'Адольф Гитлер', 'рейхсмарка', 6500, 412, 'Берлин'),
    SU: S('СССР', '#9b2a2a', { t: 'f', c: ['#cc0000'], e: 'sickle' }, 'Иосиф Сталин', 'советский рубль', 5600, 359, 'Москва'),
    GB: S('Великобритания', '#c24a5a', 'cdn:gb', 'Уинстон Черчилль', 'фунт стерлингов', 3600, 344, 'Лондон'),
    US: S('США', '#3d6fb0', 'cdn:us', 'Франклин Рузвельт', 'доллар США', 4200, 1094, 'Вашингтон'),
    JP: S('Японская империя', '#e8e2d0', 'cdn:jp', 'Фумимаро Коноэ', 'японская иена', 3200, 196, 'Токио'),
    IT: S('Королевство Италия', '#4f8a4a', { t: 'v', c: ['#009246', '#fff', '#ce2b37'], e: 'cross' }, 'Бенито Муссолини', 'итальянская лира', 1500, 145, 'Рим'),
    VF: S('Франция (режим Виши)', '#6a7fb8', 'cdn:fr', 'Филипп Петен', 'французский франк', 500, 110, 'Лион'),
    FF: S('Свободная Франция', '#3c5ba8', { t: 'v', c: ['#002395', '#fff', '#ed2939'], e: 'lorraine' }, 'Шарль де Голль', 'французский франк', 140, 6, 'Браззавиль'),
    CN: S('Китайская Республика', '#c9a548', { e: 'roc' }, 'Чан Кайши', 'китайский юань (фаби)', 1600, 280, 'Чунцин'),
    WJ: S('Китай (режим Ван Цзинвэя)', '#b59a63', { e: 'rocpeace' }, 'Ван Цзинвэй', 'юань Центрального резервного банка', 260, 60, 'Нанкин'),
    MQ: S('Маньчжоу-го', '#c9b23f', { e: 'manchu' }, 'Пу И', 'маньчжоуский юань', 350, 30, 'Чанчунь'),
    CA: S('Канада', '#b85656', { t: 'f', c: ['#c8102e'], e: 'ensign' }, 'Уильям Лайон Маккензи Кинг', 'канадский доллар', 520, 66),
    AU: S('Австралия', '#4f8f82', 'cdn:au', 'Роберт Мензис', 'австралийский фунт', 450, 50),
    NZ: S('Новая Зеландия', '#5f9ea0', 'cdn:nz', 'Питер Фрейзер', 'новозеландский фунт', 120, 12),
    ZA: S('Южно-Африканский Союз', '#c08040', { t: 'h', c: ['#ff7f00', '#fff', '#002395'] }, 'Ян Смэтс', 'южноафриканский фунт', 300, 25),
    RO: S('Румыния', '#c4a35a', 'cdn:ro', 'Ион Антонеску', 'румынский лей', 700, 19),
    HU: S('Венгрия', '#7f9a5c', 'cdn:hu', 'Миклош Хорти', 'пенгё', 500, 22),
    FI: S('Финляндия', '#e0e6ee', 'cdn:fi', 'Ристо Рюти', 'финская марка', 450, 9),
    SK: S('Словакия', '#5b7fa9', { t: 'h', c: ['#fff', '#0b4ea2', '#ee1c25'], e: 'dblcross' }, 'Йозеф Тисо', 'словацкая крона', 150, 4),
    BG: S('Болгария', '#6a9a5a', 'cdn:bg', 'Борис III', 'болгарский лев', 350, 6),
    HR: S('Хорватия (НГХ)', '#a85a6b', { t: 'h', c: ['#c8102e', '#fff', '#171796'], e: 'check' }, 'Анте Павелич', 'хорватская куна', 200, 5, 'Загреб'),
    TR: S('Турция', '#a84848', 'cdn:tr', 'Исмет Инёню', 'турецкая лира', 700, 20),
    ES: S('Испания', '#d4b83a', { t: 'h', c: ['#c60b1e', '#ffc400', '#c60b1e'], k: [1, 2, 1], e: 'disc', ec: '#4a2a0a' }, 'Франсиско Франко', 'испанская песета', 600, 45),
    PT: S('Португалия', '#4a9a5a', 'cdn:pt', 'Антониу Салазар', 'португальский эскудо', 200, 12),
    SE: S('Швеция', '#5b8fc9', 'cdn:se', 'Пер Альбин Ханссон', 'шведская крона', 500, 20),
    CH: S('Швейцария', '#b04040', 'cdn:ch', 'Эрнст Веттер', 'швейцарский франк', 350, 18),
    IE: S('Ирландия', '#4caf6a', 'cdn:ie', 'Имон де Валера', 'ирландский фунт', 100, 5),
    IS: S('Исландия', '#7fa7d9', 'cdn:is', 'Свейн Бьёрнссон', 'исландская крона', 5, 0.5),
    TH: S('Таиланд', '#8b6ba9', 'cdn:th', 'Плек Пибунсонграм', 'тайский бат', 300, 8),
    IR: S('Иран', '#6a9a5a', { t: 'h', c: ['#239f40', '#fff', '#da0000'], e: 'disc', ec: '#e8b923' }, 'Реза Шах Пехлеви', 'иранский риал', 250, 10),
    IQ: S('Ирак', '#9b9b5b', { t: 'h', c: ['#111', '#fff', '#007a3d'], e: 'iraq' }, 'Абд аль-Илах (регент)', 'иракский динар', 120, 3),
    EG: S('Египет', '#c4b06a', { t: 'f', c: ['#008000'], e: 'egypt' }, 'Фарук I', 'египетский фунт', 150, 12),
    SA: S('Саудовская Аравия', '#5ca95c', 'cdn:sa', 'Абдул-Азиз ибн Сауд', 'саудовский риал', 120, 2),
    YE: S('Йемен', '#b97b4b', { t: 'f', c: ['#c8102e'], e: 'star' }, 'Имам Яхья', 'йеменский риал', 60, 1),
    OM: S('Маскат и Оман', '#b05050', { t: 'f', c: ['#c8102e'] }, 'Саид бин Таймур', 'индийская рупия', 30, 0.3),
    AF: S('Афганистан', '#6b8b51', { t: 'v', c: ['#111', '#c8102e', '#007a36'], e: 'disc', ec: '#fff' }, 'Мухаммед Захир-шах', 'афгани', 100, 3),
    NP: S('Непал', '#c06060', 'cdn:np', 'Джуддха Шамшер Рана', 'непальская рупия', 80, 2),
    BT: S('Бутан', '#e0a040', 'cdn:bt', 'Джигме Вангчук', 'индийская рупия', 10, 0.1),
    MN: S('Монголия', '#5aa4b8', 'cdn:mn', 'Хорлогийн Чойбалсан', 'тугрик', 120, 0.5),
    TU: S('Тувинская Народная Республика', '#5b7fa9', { e: 'tuva' }, 'Салчак Тока', 'тувинский акша', 20, 0.05, 'Кызыл'),
    ET: S('Эфиопия', '#7fa24c', { t: 'h', c: ['#078930', '#fcdd09', '#da121a'] }, 'Хайле Селассие I', 'эфиопский талер', 150, 3),
    LR: S('Либерия', '#9b6b8b', 'cdn:lr', 'Эдвин Баркли', 'либерийский доллар', 20, 0.3),
    NL: S('Нидерланды (в изгнании)', '#e07a30', 'cdn:nl', 'Вильгельмина', 'нидерландский гульден', 200, 15),
    BE: S('Бельгия (в изгнании)', '#d4a017', 'cdn:be', 'Юбер Пьерло', 'бельгийский франк', 80, 3),
    DK: S('Дания', '#c86a6a', 'cdn:dk', 'Кристиан X', 'датская крона', 20, 0.5),
    BR: S('Бразилия', '#4a9a5a', 'cdn:br', 'Жетулиу Варгас', 'бразильский милрейс', 450, 50),
    AR: S('Аргентина', '#7fb3d9', 'cdn:ar', 'Рамон Кастильо', 'аргентинское песо', 400, 40),
    MX: S('Мексика', '#5a9a6a', 'cdn:mx', 'Мануэль Авила Камачо', 'мексиканское песо', 250, 25),
    CU: S('Куба', '#5b7fa9', 'cdn:cu', 'Фульхенсио Батиста', 'кубинское песо', 60, 3),
    CL: S('Чили', '#b85656', 'cdn:cl', 'Педро Агирре Серда', 'чилийское песо', 120, 8),
  };
  // остальные независимые государства 1941 года — с современными флагами
  'PE CO VE BO PY UY EC HT DO GT HN SV NI CR PA AD MC LI SM VA'.split(' ').forEach(id => (countries[id] = { flag: 'cdn:' + id.toLowerCase() }));

  // ---------- кому принадлежит территория на 22 июня 1941 ----------
  const byISO = {};
  const put = (owner, list) => list.split(' ').forEach(c => (byISO[c] = owner));
  put('SU', 'RU UA BY LT LV EE MD GE AM AZ KZ UZ TM KG TJ');
  put('DE', 'DE AT CZ PL LU NL BE NO DK RS GR');
  put('IT', 'IT AL XK ME SI LY');
  put('HR', 'HR BA');
  put('BG', 'MK');
  put('GB', 'GB IN PK BD MM LK MY SG BN IL PS JO CY MT KW BH QA AE SD SS KE UG TZ NG GH SL GM ZW ZM MW BW LS SZ SO ER ' +
    'GY BZ JM TT BB BS AG DM GD KN LC VC FJ SB KI TV VU TO MU SC MV');
  put('VF', 'FR MA DZ TN MR ML SN GN CI BF NE BJ TG MG KM DJ SY LB VN LA KH');
  put('FF', 'TD CM CG GA CF');
  put('BE', 'CD RW BI');
  put('PT', 'PT AO MZ GW CV ST TL');
  put('ES', 'ES GQ');
  put('NL', 'ID SR');
  put('ZA', 'ZA NA');
  put('AU', 'AU PG NR');
  put('NZ', 'NZ WS');
  put('US', 'US PH');
  put('JP', 'JP KR KP TW FM MH PW');
  const byCity = {
    // Франция: оккупированный север и аннексированные Эльзас и Лотарингия
    'Париж': 'DE', 'Лилль': 'DE', 'Бордо': 'DE', 'Нант': 'DE', 'Гавр': 'DE', 'Тур': 'DE', 'Страсбург': 'DE', 'Мец': 'DE',
    // Балканы после апреля 1941
    'Марибор': 'DE', 'Сплит': 'IT', 'Риека': 'IT', 'Суботица': 'HU', 'Патры': 'IT', 'Лариса': 'IT',
    'Кошице': 'HU', 'Клуж-Напока': 'HU',
    // Восточная Пруссия, Мемель, Карафуто, Тува
    'Калининград': 'DE', 'Клайпеда': 'DE', 'Южно-Сахалинск': 'JP', 'Кызыл': 'TU',
    // Китай: Маньчжоу-го, Квантунская область, режим Ван Цзинвэя на оккупированных землях
    'Шэньян': 'MQ', 'Харбин': 'MQ', 'Чанчунь': 'MQ', 'Цицикар': 'MQ', 'Муданьцзян': 'MQ', 'Цзямусы': 'MQ', 'Чифэн': 'MQ', 'Байшань': 'MQ',
    'Далянь': 'JP',
    'Нанкин': 'WJ', 'Шанхай': 'WJ', 'Пекин': 'WJ', 'Ухань': 'WJ', 'Гуанчжоу': 'WJ', 'Сюйчжоу': 'WJ', 'Цзыбо': 'WJ', 'Тайюань': 'WJ',
    'Наньчан': 'WJ', 'Аньцин': 'WJ', 'Хэншуй': 'WJ', 'Ичжоу': 'WJ', 'Фучжоу': 'WJ', 'Хайкоу': 'WJ', 'Датун': 'WJ', 'Баотоу': 'WJ',
    // Индокитай: Баттамбанг отошёл Таиланду после франко-тайской войны
    'Баттамбанг': 'TH',
    // Аравия и Африка
    'Аден': 'GB', 'Эль-Мукалла': 'GB', 'Сайвун': 'GB', 'Атак': 'GB', 'Эль-Гайда': 'GB',
    'Танжер': 'ES', 'Эль-Аюн': 'ES', 'Дахла': 'ES',
    // Фарерские острова заняли британцы; Гренландия осталась за датской администрацией
    'Торсхавн': 'GB',
  };
  // законный владелец оккупированных земель (для штриховки на карте)
  const coreByISO = { FR: 'VF', NL: 'NL', BE: 'BE', DK: 'DK', CN: 'CN' };
  const coreByCity = { 'Страсбург': 'VF', 'Мец': 'VF', 'Далянь': 'CN' };

  function ownerCore(p) {
    let own = byCity[p.name] || byISO[p.core] || (countries[p.core] ? p.core : 'GB');
    if (p.core === 'DK' && p.lon < -10) own = 'DK'; // Гренландия
    let core = coreByCity[p.name] || coreByISO[p.core] || own;
    if (p.core === 'CN' && (own === 'CN' || own === 'MQ' || own === 'WJ')) core = own === 'CN' ? 'CN' : 'CN';
    if (p.core === 'DK' && own === 'DK') core = 'DK';
    return [own, countries[core] ? core : own];
  }

  // ---------- союзы, войны, помощь ----------
  const alliances = [
    { name: 'Ось (Тройственный пакт)', members: 'DE IT JP HU RO SK BG HR MQ WJ' },
    { name: 'Британское Содружество', members: 'GB CA AU NZ ZA' },
    { name: 'Союзники', members: 'GB FF NL BE' },
    { name: 'Советско-монгольский договор', members: 'SU MN TU' },
  ];
  const rivals = [['Ось (Тройственный пакт)', 'Британское Содружество'], ['Ось (Тройственный пакт)', 'Союзники'], ['Ось (Тройственный пакт)', 'Советско-монгольский договор']];
  const wars = [
    { name: 'Великая Отечественная война', a: 'DE IT RO SK HU FI HR', b: 'SU' },
    { name: 'Вторая мировая война', a: 'DE IT', b: 'GB CA AU NZ ZA FF NL BE' },
    { name: 'Японо-китайская война', a: 'JP MQ WJ', b: 'CN' },
  ];
  const aid = { SU: ['GB', 'US'], GB: ['US'], CN: ['US', 'SU'] }; // ленд-лиз
  const tensions = [['JP', 'US'], ['JP', 'GB'], ['JP', 'NL'], ['DE', 'US'], ['SU', 'IR'], ['GB', 'IR'], ['JP', 'SU'], ['DE', 'SE'], ['TH', 'VF']];
  const friends = [['DE', 'IT'], ['DE', 'JP'], ['GB', 'US'], ['SU', 'MN'], ['US', 'CA'], ['GB', 'CA'], ['DE', 'ES']];
  const popScale = { Europe: 0.62, Asia: 0.3, Africa: 0.13, 'North America': 0.36, 'South America': 0.22, Oceania: 0.4 };

  return { start: [1941, 5, 22], title: '22 июня 1941', countries, draw, ownerCore, alliances, rivals, wars, aid, tensions, friends, popScale };
})();
