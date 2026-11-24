import type { Language } from '../i18n';

/** Screenshot names: public/about/<language>/<name>.webp (made by scripts/about-screenshots.mjs). */
export const SHOTS = [
  'course',
  'small-maths',
  'take-away',
  'logic',
  'english',
  'summary',
  'app-bar',
  'leaderboard',
] as const;
export type Shot = (typeof SHOTS)[number];

/** Size of every screenshot (390 x 844 phone, portrait). */
export const SHOT_SIZE = { width: 390, height: 844 } as const;

type ShotCopy = { caption: string; alt: string };

/**
 * About page text (SCRUM-218, approved by Peter). Course, level and "What we store" texts are not
 * repeated here: the page takes them from the app's copy (src/i18n.ts), so they stay one source.
 * Level details are the short explanations in brackets after each level name.
 */
export const aboutCopy = {
  en: {
    title: 'About Bearmatics',
    pageTitle: 'About Bearmatics',
    intro:
      'Bearmatics is a free learning app for children aged 5–9, in Slovak and English. A friendly bear guides your child through short lessons in maths, logic and English. It runs in a web browser on phones, tablets, foldable phones and computers – nothing to install, no ads.',
    languages: 'Language / Jazyk',
    play: "Let's play",
    opensFull: '(full size, opens in a new tab)',
    coursesTitle: 'Courses',
    smallLead: 'with pictures for the youngest',
    logicLead: 'think ahead and plan the way',
    logicDetail: 'plan the way with arrows, up to 4 steps',
    logicDetail2: 'stones stand in the way: find the free way, up to 6 steps',
    englishLead: '21 school words spoken in a British voice',
    levelDetails: {
      0: 'add up to 6',
      8: 'take pictures out of a basket, up to 6',
      9: 'add two dice, results 7–12',
      1: 'up to 10',
      2: 'add and subtract up to 10',
      3: 'up to 20',
      4: 'up to 20',
      5: 'up to 100',
      6: 'multiply with 1–5',
      7: 'multiply and divide with 1–10',
    },
    lessonTitle: 'How a lesson works',
    lesson: [
      'Choose a level and 5, 10 or 20 exercises.',
      'Answer with the on-screen number pad or the keyboard. A wrong answer can simply be tried again.',
      'In Maths, hints show the problem in smaller steps.',
      'In Logic, your child plans the bear’s way to the honey with arrows and then presses Go. A short picture demo shows how at the first Logic lesson on a device; Show me plays it again any time.',
      'Exercises that needed more tries come back in a short review round.',
      'The summary shows how many were right on the first try without hints.',
      'It also shows how long the lesson took and about how long one exercise took. The time is not saved anywhere.',
      'Mute switches the sounds off; English words are always spoken.',
    ],
    signInTitle: 'Signing in (optional)',
    signIn: [
      'Everything works without an account.',
      'Sign in with Google or a username and password to collect points: 1 point for each exercise right on the first try in a finished lesson.',
      'An easy level played again on one day gives fewer points: from the 3rd play half, from the 5th play a quarter (rounded up). The first play of the day of a harder level (Maths levels 4–7, level 3 of Small maths and English) gives 1.5 times the points. Logic always gives whole points. A small sign in the level menu shows this for the next play: ★, 1/2 or 1/4.',
      'Points grow your bear badge. Play every day to build a streak; missed days freeze it and points can unlock it.',
      'A leaderboard shows nickname, bear, bear badge, streak and points of players; you can hide yourself in the profile.',
      'The profile is only a nickname and a bear your child dresses from parts (fur, background, something for the head, neck and eyes); the bear look is stored as five numbers, no photo or real name. The account can be deleted any time.',
      'Sign out and Delete account first ask a question for a grown-up, so a child cannot press them by mistake.',
    ],
    dataTitle: 'Your data',
    data: [
      'Without an account nothing about your child is stored on our server.',
      'With an account we store only what is needed for points, badge and streak.',
    ],
    dataLast: 'No ads, no selling or sharing of data. Full details:',
    shots: {
      course: {
        caption: 'Choosing a course',
        alt: 'Bearmatics on a phone: the bear and the four courses Small maths, Logic, Maths and English.',
      },
      'small-maths': {
        caption: 'Small maths: count the pictures',
        alt: 'A Small maths exercise: two groups of pictures to add, with the number pad below.',
      },
      'take-away': {
        caption: 'Small maths: take away',
        alt: 'A take-away exercise: pictures in a basket, some of them taken out, and the number pad.',
      },
      logic: {
        caption: 'Logic: guide the bear around the stones to the honey',
        alt: 'A Logic level 2 exercise: a 4 by 4 grid with the bear, a honey pot and two stones, six planned arrows, the arrow buttons and Go.',
      },
      english: {
        caption: 'English: listen and choose',
        alt: 'An English listen-and-choose exercise: a speaker button and four word buttons.',
      },
      summary: {
        caption: 'Lesson summary',
        alt: 'The end of a lesson: exercises right on the first try without hints, the lesson time, new points and the streak.',
      },
      'app-bar': {
        caption: 'Bear badge, points and streak',
        alt: 'The Maths levels; at the top the bear badge with the points and the streak of a test player.',
      },
      leaderboard: {
        caption: 'Leaderboard',
        alt: 'The leaderboard with made-up players and their bear badges: places 1 to 10, two players sharing place 3, then places 12 to 14 with the test player Demo Bear at place 13.',
      },
    } satisfies Record<Shot, ShotCopy>,
  },
  sk: {
    title: 'O aplikácii Bearmatics',
    pageTitle: 'O aplikácii Bearmatics',
    intro:
      'Bearmatics je bezplatná aplikácia na učenie pre deti od 5 do 9 rokov, v slovenčine a angličtine. Priateľský medveď sprevádza dieťa krátkymi lekciami matematiky, logiky a angličtiny. Funguje vo webovom prehliadači na mobile, tablete, skladacom telefóne aj počítači – bez inštalácie a bez reklám.',
    languages: 'Language / Jazyk',
    play: 'Poď hrať',
    opensFull: '(plná veľkosť, otvorí sa na novej karte)',
    coursesTitle: 'Kurzy',
    smallLead: 's obrázkami pre najmenších',
    logicLead: 'mysli dopredu a naplánuj cestu',
    logicDetail: 'naplánuj cestu šípkami, najviac 4 kroky',
    logicDetail2: 'v ceste stoja kamene: nájdi voľnú cestu, najviac 6 krokov',
    englishLead: '21 slov zo školy v britskej výslovnosti',
    levelDetails: {
      0: 'sčítanie s obrázkami do 6',
      8: 'vyber obrázky z košíka, do 6',
      9: 'dve kocky, výsledok 7 až 12',
      1: 'do 10',
      2: 'sčítanie a odčítanie do 10',
      3: 'do 20',
      4: 'do 20',
      5: 'do 100',
      6: 'násobenie číslami 1–5',
      7: 'násobenie a delenie číslami 1–10',
    },
    lessonTitle: 'Ako prebieha lekcia',
    lesson: [
      'Vyber úroveň a 5, 10 alebo 20 príkladov.',
      'Odpoveď napíš číselníkom na obrazovke alebo klávesnicou. Nesprávnu odpoveď môžeš skúsiť znova.',
      'V Matematike pomôcky ukážu príklad v menších krokoch.',
      'V Logike dieťa naplánuje šípkami cestu medveďa k medu a potom stlačí Choď. Krátka obrázková ukážka ukáže ako pri prvej lekcii Logiky na zariadení; tlačidlo Ukáž mi ju kedykoľvek zopakuje.',
      'Príklady, ktoré potrebovali viac pokusov, sa vrátia v krátkom opakovaní.',
      'Na konci vidíš, koľko príkladov bolo správne na prvý pokus bez pomôcky.',
      'Uvidíš aj, ako dlho lekcia trvala a koľko asi trval jeden príklad. Čas sa nikam neukladá.',
      'Tlačidlo zvuku vypne zvuky; anglické slová zaznejú vždy.',
    ],
    signInTitle: 'Prihlásenie (nepovinné)',
    signIn: [
      'Všetko funguje aj bez účtu.',
      'Prihlásenie cez Google alebo menom a heslom zbiera body: 1 bod za každý príklad správne na prvý pokus v dokončenej lekcii.',
      'Ľahká úroveň zahraná v jeden deň znova dáva menej bodov: od 3. hry polovicu, od 5. hry štvrtinu (zaokrúhlené nahor). Prvá hra dňa na ťažšej úrovni (Matematika úrovne 4–7, úroveň 3 v Malej matematike a Angličtine) dáva 1,5-násobok bodov. Logika dáva vždy celé body. Malá značka v ponuke úrovní to ukazuje pre ďalšiu hru: ★, 1/2 alebo 1/4.',
      'Body zväčšujú medvedí odznak. Hraj každý deň a buduj sériu; vynechané dni ju zmrazia a body ju môžu odomknúť.',
      'Rebríček ukazuje prezývku, medveďa, medvedí odznak, sériu a body hráčov; v profile sa môžeš skryť.',
      'Profil je len prezývka a medvedík, ktorého si dieťa oblečie z dielikov (srsť, pozadie, niečo na hlavu, krk a oči); vzhľad medvedíka sa ukladá ako päť čísel, žiadna fotka ani skutočné meno. Účet sa dá kedykoľvek zmazať.',
      'Pri odhlásení a zmazaní účtu sa najprv objaví otázka pre dospelého, aby to dieťa neurobilo omylom.',
    ],
    dataTitle: 'Vaše údaje',
    data: [
      'Bez účtu o dieťati na serveri nič neukladáme.',
      'S účtom ukladáme len to, čo treba pre body, odznak a sériu.',
    ],
    dataLast: 'Žiadne reklamy, údaje nepredávame ani nezdieľame. Podrobnosti:',
    shots: {
      course: {
        caption: 'Výber kurzu',
        alt: 'Bearmatics na mobile: medveď a štyri kurzy Malá matematika, Logika, Matematika a Angličtina.',
      },
      'small-maths': {
        caption: 'Malá matematika: počítame obrázky',
        alt: 'Príklad z Malej matematiky: dve skupiny obrázkov na sčítanie a pod nimi číselník.',
      },
      'take-away': {
        caption: 'Malá matematika: odoberáme',
        alt: 'Príklad na odoberanie: obrázky v košíku, niektoré vybrané, a číselník.',
      },
      logic: {
        caption: 'Logika: priveď medveďa okolo kameňov k medu',
        alt: 'Príklad z Logiky, úroveň 2: mriežka 4 krát 4 s medveďom, hrncom medu a dvoma kameňmi, šesť naplánovaných šípok, tlačidlá so šípkami a Choď.',
      },
      english: {
        caption: 'Angličtina: počúvaj a vyber',
        alt: 'Úloha z angličtiny Počúvaj a vyber: tlačidlo reproduktora a štyri tlačidlá so slovami.',
      },
      summary: {
        caption: 'Koniec lekcie',
        alt: 'Koniec lekcie: príklady správne na prvý pokus bez pomôcky, čas lekcie, nové body a séria.',
      },
      'app-bar': {
        caption: 'Medvedí odznak, body a séria',
        alt: 'Úrovne Matematiky; hore medvedí odznak s bodmi a séria testovacieho hráča.',
      },
      leaderboard: {
        caption: 'Rebríček',
        alt: 'Rebríček s vymyslenými hráčmi a ich medvedími odznakmi: miesta 1 až 10, dvaja hráči na spoločnom 3. mieste, potom miesta 12 až 14 s testovacím hráčom Demo Bear na 13. mieste.',
      },
    } satisfies Record<Shot, ShotCopy>,
  },
} satisfies Record<Language, unknown>;

export type AboutCopy = (typeof aboutCopy)[Language];
