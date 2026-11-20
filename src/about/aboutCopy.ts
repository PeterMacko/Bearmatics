import type { Language } from '../i18n';

/** Screenshot names: public/about/<language>/<name>.webp (made by scripts/about-screenshots.mjs). */
export const SHOTS = [
  'course',
  'small-maths',
  'take-away',
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
      'Bearmatics is a free learning app for children aged 6–9, in Slovak and English. A friendly bear guides your child through short lessons in maths and English. It runs in a web browser on phones, tablets, foldable phones and computers – nothing to install, no ads.',
    languages: 'Language / Jazyk',
    play: "Let's play",
    opensFull: '(full size, opens in a new tab)',
    coursesTitle: 'Courses',
    smallLead: 'with pictures for the youngest',
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
      'Exercises that needed more tries come back in a short review round.',
      'The summary shows how many were right on the first try without hints.',
      'Mute switches the sounds off; English words are always spoken.',
    ],
    signInTitle: 'Signing in (optional)',
    signIn: [
      'Everything works without an account.',
      'Sign in with Google or a username and password to collect points: 1 point for each exercise right on the first try in a finished lesson.',
      'Points grow your bear badge. Play every day to build a streak; missed days freeze it and points can unlock it.',
      'A leaderboard shows nickname, bear, streak and points of players; you can hide yourself in the profile.',
      'The profile is only a nickname and a bear icon. The account can be deleted any time.',
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
        alt: 'Bearmatics on a phone: the bear and the three courses Small maths, Maths and English.',
      },
      'small-maths': {
        caption: 'Small maths: count the pictures',
        alt: 'A Small maths exercise: two groups of pictures to add, with the number pad below.',
      },
      'take-away': {
        caption: 'Small maths: take away',
        alt: 'A take-away exercise: pictures in a basket, some of them taken out, and the number pad.',
      },
      english: {
        caption: 'English: listen and choose',
        alt: 'An English listen-and-choose exercise: a speaker button and four word buttons.',
      },
      summary: {
        caption: 'Lesson summary',
        alt: 'The end of a lesson: exercises right on the first try without hints, new points and the streak.',
      },
      'app-bar': {
        caption: 'Bear badge, points and streak',
        alt: 'The Maths levels; at the top the bear badge with the points and the streak of a test player.',
      },
      leaderboard: {
        caption: 'Leaderboard',
        alt: 'The leaderboard with made-up players: places 1 to 10, two players sharing place 3, then places 12 to 14 with the test player Demo Bear at place 13.',
      },
    } satisfies Record<Shot, ShotCopy>,
  },
  sk: {
    title: 'O aplikácii Bearmatics',
    pageTitle: 'O aplikácii Bearmatics',
    intro:
      'Bearmatics je bezplatná aplikácia na učenie pre deti od 6 do 9 rokov, v slovenčine a angličtine. Priateľský medveď sprevádza dieťa krátkymi lekciami matematiky a angličtiny. Funguje vo webovom prehliadači na mobile, tablete, skladacom telefóne aj počítači – bez inštalácie a bez reklám.',
    languages: 'Language / Jazyk',
    play: 'Poď hrať',
    opensFull: '(plná veľkosť, otvorí sa na novej karte)',
    coursesTitle: 'Kurzy',
    smallLead: 's obrázkami pre najmenších',
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
      'Príklady, ktoré potrebovali viac pokusov, sa vrátia v krátkom opakovaní.',
      'Na konci vidíš, koľko príkladov bolo správne na prvý pokus bez pomôcky.',
      'Tlačidlo zvuku vypne zvuky; anglické slová zaznejú vždy.',
    ],
    signInTitle: 'Prihlásenie (nepovinné)',
    signIn: [
      'Všetko funguje aj bez účtu.',
      'Prihlásenie cez Google alebo menom a heslom zbiera body: 1 bod za každý príklad správne na prvý pokus v dokončenej lekcii.',
      'Body zväčšujú medvedí odznak. Hraj každý deň a buduj sériu; vynechané dni ju zmrazia a body ju môžu odomknúť.',
      'Rebríček ukazuje prezývku, medveďa, sériu a body hráčov; v profile sa môžeš skryť.',
      'Profil je len prezývka a ikona medveďa. Účet sa dá kedykoľvek zmazať.',
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
        alt: 'Bearmatics na mobile: medveď a tri kurzy Malá matematika, Matematika a Angličtina.',
      },
      'small-maths': {
        caption: 'Malá matematika: počítame obrázky',
        alt: 'Príklad z Malej matematiky: dve skupiny obrázkov na sčítanie a pod nimi číselník.',
      },
      'take-away': {
        caption: 'Malá matematika: odoberáme',
        alt: 'Príklad na odoberanie: obrázky v košíku, niektoré vybrané, a číselník.',
      },
      english: {
        caption: 'Angličtina: počúvaj a vyber',
        alt: 'Úloha z angličtiny Počúvaj a vyber: tlačidlo reproduktora a štyri tlačidlá so slovami.',
      },
      summary: {
        caption: 'Koniec lekcie',
        alt: 'Koniec lekcie: príklady správne na prvý pokus bez pomôcky, nové body a séria.',
      },
      'app-bar': {
        caption: 'Medvedí odznak, body a séria',
        alt: 'Úrovne Matematiky; hore medvedí odznak s bodmi a séria testovacieho hráča.',
      },
      leaderboard: {
        caption: 'Rebríček',
        alt: 'Rebríček s vymyslenými hráčmi: miesta 1 až 10, dvaja hráči na spoločnom 3. mieste, potom miesta 12 až 14 s testovacím hráčom Demo Bear na 13. mieste.',
      },
    } satisfies Record<Shot, ShotCopy>,
  },
} satisfies Record<Language, unknown>;

export type AboutCopy = (typeof aboutCopy)[Language];
