import React, { useState } from "react";
2import { Sparkles, BookOpen, Music, Copy, Check, Search, Calendar as CalendarIcon, Disc, ArrowRight, Edit3, Play, Loader2, Wand2 } from "lucide-react";
3import { writeLyrics, generateSong } from "@flowmusic/sdk";
4import type { Clip } from "@flowmusic/sdk";
5
6type Mood = "Melancholic" | "Retro" | "Energetic" | "Dark";
7type Audience = "Kids <12" | "Teens" | "Adults 20-40" | "Mature 50+";
8
9interface RhymeEntry {
10  word: string;
11  category: string;
12  exactRhymes: string[];
13  poeticRhymes: string[];
14  exampleLines: string[];
15}
16
17interface NameDayEntry {
18  date: string;
19  displayDate: string;
20  names: string[];
21  suggestedMood: Mood;
22  poeticVibe: string;
23}
24
25const POLISH_RHYMES_DATABASE: RhymeEntry[] = [
26  {
27    word: "Światło",
28    category: "Światło i Cień",
29    exactRhymes: ["Ciało", "Zostało", "Migało", "Przeszło", "Wracało", "Pachniało"],
30    poeticRhymes: ["Cień", "Puls", "Jasność", "Złoto", "Świt", "Blask"],
31    exampleLines: [
32      "Gdy gaśnie światło, zostaje cichy ślad...",
33      "Twoje światło wciąż rozprasza gęsty mrok..."
34    ]
35  },
36  {
37    word: "Cień",
38    category: "Światło i Cień",
39    exactRhymes: ["Dzień", "Lenię", "Korzeń", "Promień", "Płomień"],
40    poeticRhymes: ["Świt", "Noc", "Sen", "Mgła", "Wiatr"],
41    exampleLines: [
42      "Przez rzucony cień dostrzegam novą drogę...",
43      "Każdy twój cień ma dzisiaj barwę wspomnień..."
44    ]
45  },
46  {
47    word: "Czas",
48    category: "Czas i Droga",
49    exactRhymes: ["Las", "Blask", "Hałas", "Znasz", "Głos", "Nasz"],
50    poeticRhymes: ["Puls", "Krok", "Ślad", "Noc", "Świt"],
51    exampleLines: [
52      "Ucieka czas, lecz my pamiętamy sen...",
53      "Wokół nas tylko ten cichy, mroczny blask..."
54    ]
55  },
56  {
57    word: "Droga",
58    category: "Czas i Droga",
59    exactRhymes: ["Trwoga", "Boga", "Progach", "Ostroga"],
60    poeticRhymes: ["Krok", "Cień", "Ślad", "Cel", "Noc"],
61    exampleLines: [
62      "Długa droga prosto w synth-popowy świt...",
63      "Na starych progach zostawiasz własny ślad..."
64    ]
65  },
66  {
67    word: "Anna",
68    category: "Imiona i Dedykacje",
69    exactRhymes: ["Manna", "Szklanna", "Marianna", "Tanna"],
70    poeticRhymes: ["Świt", "Cień", "Płomień", "Jasność", "Sen"],
71    exampleLines: [
72      "Anna, w tym świetle twój krok ma własny rytm...",
73      "Gdy śpiewam Twoje imię, Anna, gaśnie mrok..."
74    ]
75  },
76  {
77    word: "Piotr",
78    category: "Imiona i Dedykacje",
79    exactRhymes: ["Wiatr", "Kadr", "Teatr", "Licznik"],
80    poeticRhymes: ["Ogień", "Puls", "Głos", "Krok", "Ślad"],
81    exampleLines: [
82      "Piotr, w tym pulsie odnajdziesz dawny sens...",
83      "Gdy idzie Piotr, ciemność ustępuje w krok..."
84    ]
85  },
86  {
87    word: "Kasia",
88    category: "Imiona i Dedykacje",
89    exactRhymes: ["Basia", "Joasia", "Wycisza", "Cisza"],
90    poeticRhymes: ["Blask", "Świt", "Melodia", "Puls"],
91    exampleLines: [
92      "Dla ciebie Kasia, ten pulsujący bas...",
93      "Kasia w refleksach neonów pisze własny ślad..."
94    ]
95  },
96  {
97    word: "Głos",
98    category: "Noc i Brzmienie",
99    exactRhymes: ["Los", "Cios", "Kłos", "Stos", "Włos"],
100    poeticRhymes: ["Puls", "Echo", "Noc", "Szepty", "Bas"],
101    exampleLines: [
102      "Jeden prosty głos przedziera się przez synth...",
103      "Ten czysty los złączył nasze kroki..."
104    ]
105  },
106  {
107    word: "Noc",
108    category: "Noc i Brzmienie",
109    exactRhymes: ["Moc", "Koc", "Pomoc", "Wielkanoc"],
110    poeticRhymes: ["Cień", "Mrok", "Puls", "Świt", "Neon"],
111    exampleLines: [
112      "Głęboka noc przykrywa cały nasz świat...",
113      "To nasza moc, pulsuje nocny rytm..."
114    ]
115  }
116];
117
118const POPULAR_NAME_DAYS: NameDayEntry[] = [
119  { date: "07-26", displayDate: "26 Lipca", names: ["Anna", "Mirosława", "Joachim"], suggestedMood: "Melancholic", poeticVibe: "Ciepły letni wieczór, zapach deszczu i nostalgiczny puls" },
120  { date: "06-29", displayDate: "29 Czerwca", names: ["Piotr", "Paweł"], suggestedMood: "Retro", poeticVibe: "Głębokie basy, pewny krok i retro-synthowa moc" },
121  { date: "11-25", displayDate: "25 Listopada", names: ["Katarzyna", "Kasia", "Erazm"], suggestedMood: "Dark", poeticVibe: "Mroźny neonowy błysk, refleksyjny klimat i głęboki beat" },
122  { date: "09-29", displayDate: "29 Września", names: ["Michał", "Michalina", "Rafał"], suggestedMood: "Energetic", poeticVibe: "Nocny pęd, światła miasta i pulsujący club wave" },
123  { date: "03-19", displayDate: "19 Marca", names: ["Józef", "Aleksandra"], suggestedMood: "Melancholic", poeticVibe: "Przełom pór roku, pierwsze światło i cichy sentyment" },
124  { date: "05-08", displayDate: "8 Maja", names: ["Stanisław", "Wiktoria"], suggestedMood: "Retro", poeticVibe: "Majowe noce, analogowy szum i powracające wspomnienia" },
125  { date: "12-24", displayDate: "24 Grudnia", names: ["Adam", "Ewa"], suggestedMood: "Dark", poeticVibe: "Ciemna noc, zimowy misticyzm i rozpalający światło synth" },
126  { date: "08-09", displayDate: "9 Sierpnia", names: ["Roman", "Ryszard"], suggestedMood: "Energetic", poeticVibe: "Sierpniowe ciepło, pędzące tempo i emocjonalna melodia" }
127];
128
129export default function Component() {
130  const [activeTab, setActiveTab] = useState<"generator" | "canvas" | "calendar" | "rhymes">("generator");
131  const [name, setName] = useState("Anna");
132  const [mood, setMood] = useState<Mood>("Melancholic");
133  const [audience, setAudience] = useState<Audience>("Adults 20-40");
134  const [customDetails, setCustomDetails] = useState("wspólne podróże, stare zdjęcia, zapach kawy");
135  const [copied, setCopied] = useState(false);
136  const [searchWord, setSearchWord] = useState("");
137  const [selectedDate, setSelectedDate] = useState("07-26");
138
139  // Canvas & Lyrics State
140  const [lyricsLines, setLyricsLines] = useState<string[]>([
141    "[Intro - atmospheric synth pads, slow pulse]",
142    "",
143    "[Verse 1]",
144    "W nocnym świetle miga stary kadru cień",
145    "Przechodzimy razem przez kolejny dzień",
146    "Ślad na drodze pachnie jak tamta faza chwil",
147    "Czas ucieka cicho, liczy każdy mil",
148    "",
149    "[Chorus]",
150    "A gdy gaśnie mrok i ustaje wiatr",
151    "Wokół ciebie Anna znów jaśnienie trwa",
152    "To dla ciebie Anna pulsuje ten bas",
153    "Niech wspomnienie czyste łączy dzisiaj nas",
154    "",
155    "[Verse 2]",
156    "Twoje wspólne podróże wciąż przynoszą sens,",
157    "W pulsie synthów słyszę ten znajomy ton",
158    "Żadne 'sto lat' nie wyda takiego brzmienia",
159    "Tylko czyste światło i ciche pragnienia",
160    "",
161    "[Outro]",
162    "Światło... Anna...",
163    "Cichy puls..."
164  ]);
165
166  const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
167  const [editPrompt, setEditPrompt] = useState("");
168
169  // AI Generation States
170  const [isAiWriting, setIsAiWriting] = useState(false);
171  const [isProducing, setIsProducing] = useState(false);
172  const [producedClip, setProducedClip] = useState<Clip | null>(null);
173  const [errorMsg, setErrorMsg] = useState<string | null>(null);
174
175  const soundPrompts: Record<Mood, string> = {
176    Melancholic: "Polish dark dance, nostalgic synth-pop, warm expressive vocal, 115 bpm, deep pulsing bass, atmospheric pads, subtle piano",
177    Retro: "Polish retro wave, 80s synth-pop, vintage drum machines, analog synths, warm vocal, 120 bpm, pulsing groove",
178    Energetic: "Polish energetic dark dance, driving synth bass, punchy drums, emotional vocals, 124 bpm, club synth-pop",
179    Dark: "Polish dark synth-pop, cinematic textures, heavy 808 bass, moody intimate vocal, 110 bpm, pulsing electronic groove"
180  };
181
182  const handleAiWriteLyrics = async () => {
183    setIsAiWriting(true);
184    setErrorMsg(null);
185    try {
186      const res = await writeLyrics({
187        prompt: `Napisz poetycką piosenkę imieninową dla osoby o imieniu ${name}. Styl: ${mood}, kategoria wiekowa: ${audience}. Dodatkowe motywy: ${customDetails}. Brak banałów takich jak sto lat.`
188      });
189      if (res.lyrics) {
190        setLyricsLines(res.lyrics.split("\n"));
191        setActiveTab("canvas");
192      }
193    } catch (err) {
194      setErrorMsg(err instanceof Error ? err.message : "Błąd podczas pisania tekstu.");
195    } finally {
196      setIsAiWriting(false);
197    }
198  };
199
200  const handleApplyLineChange = () => {
201    if (selectedLineIndex === null || !editPrompt) return;
202    const updated = [...lyricsLines];
203    updated[selectedLineIndex] = editPrompt;
204    setLyricsLines(updated);
205    setSelectedLineIndex(null);
206    setEditPrompt("");
207  };
208
209  const handleProduceSong = async () => {
210    setIsProducing(true);
211    setErrorMsg(null);
212    try {
213      const fullLyrics = lyricsLines.join("\n");
214      const clip = await generateSong({
215        soundPrompt: soundPrompts[mood],
216        lyrics: fullLyrics,
217        title: `MUZAIK - Dla ${name}`
218      });
219      setProducedClip(clip);
220    } catch (err) {
221      setErrorMsg(err instanceof Error ? err.message : "Nie udało się wyprodukować utworu.");
222    } finally {
223      setIsProducing(false);
224    }
225  };
226
227  const handleCopyText = () => {
228    navigator.clipboard.writeText(lyricsLines.join("\n"));
229    setCopied(true);
230    setTimeout(() => setCopied(false), 2000);
231  };
232
233  const handleSelectNameDay = (selectedName: string, entryMood: Mood, vibe: string) => {
234    setName(selectedName);
235    setMood(entryMood);
236    setCustomDetails(vibe);
237    setActiveTab("generator");
238  };
239
240  const currentNameDay = POPULAR_NAME_DAYS.find(d => d.date === selectedDate) || POPULAR_NAME_DAYS[0];
241
242  const filteredRhymes = POLISH_RHYMES_DATABASE.filter(entry =>
243    entry.word.toLowerCase().includes(searchWord.toLowerCase()) ||
244    entry.exactRhymes.some(r => r.toLowerCase().includes(searchWord.toLowerCase())) ||
245    entry.poeticRhymes.some(r => r.toLowerCase().includes(searchWord.toLowerCase()))
246  );
247
248  return (
249    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
250      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
251        {/* Header */}
252        <div className="bg-gradient-to-r from-purple-900/50 via-slate-900 to-indigo-900/50 p-6 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
253          <div className="flex items-center gap-3">
254            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 text-purple-400">
255              <Disc className="w-7 h-7 animate-spin-slow" />
256            </div>
257            <div>
258              <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">
259                MUZAIK Studio Assistant
260              </h1>
261              <p className="text-xs text-slate-400">
262                Spersonalizowane Piosenki Imieninowe • Polish Dark Dance & Synth-Pop
263              </p>
264            </div>
265          </div>
266
267          {/* Tab Navigation */}
268          <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800 flex-wrap gap-1">
269            <button
270              onClick={() => setActiveTab("generator")}
271              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
272                activeTab === "generator"
273                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
274                  : "text-slate-400 hover:text-slate-200"
275              }`}
276            >
277              <Music className="w-4 h-4" /> Generator
278            </button>
279            <button
280              onClick={() => setActiveTab("canvas")}
281              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
282                activeTab === "canvas"
283                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
284                  : "text-slate-400 hover:text-slate-200"
285              }`}
286            >
287              <Edit3 className="w-4 h-4" /> Kanwa Tekstu
288            </button>
289            <button
290              onClick={() => setActiveTab("calendar")}
291              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
292                activeTab === "calendar"
293                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
294                  : "text-slate-400 hover:text-slate-200"
295              }`}
296            >
297              <CalendarIcon className="w-4 h-4" /> Kalendarium
298            </button>
299            <button
300              onClick={() => setActiveTab("rhymes")}
301              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
302                activeTab === "rhymes"
303                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
304                  : "text-slate-400 hover:text-slate-200"
305              }`}
306            >
307              <BookOpen className="w-4 h-4" /> Rymy
308            </button>
309          </div>
310        </div>
311
312        {/* Content Area */}
313        <div className="p-6">
314          {errorMsg && (
315            <div className="mb-4 p-3 bg-red-900/40 border border-red-700/60 rounded-xl text-xs text-red-300">
316              {errorMsg}
317            </div>
318          )}
319
320          {activeTab === "generator" ? (
321            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
322              {/* Form Controls */}
323              <div className="lg:col-span-5 space-y-4 bg-slate-950/40 p-5 rounded-xl border border-slate-800/80">
324                <div>
325                  <label className="text-xs font-semibold uppercase tracking-wider text-purple-400 block mb-1">
326                    Imię Solenizanta
327                  </label>
328                  <input
329                    type="text"
330                    value={name}
331                    onChange={(e) => setName(e.target.value)}
332                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-purple-500"
333                    placeholder="np. Anna, Piotr..."
334                  />
335                </div>
336
337                <div>
338                  <label className="text-xs font-semibold uppercase tracking-wider text-purple-400 block mb-1">
339                    Klimat / Nastrój
340                  </label>
341                  <div className="grid grid-cols-2 gap-2">
342                    {(["Melancholic", "Retro", "Energetic", "Dark"] as Mood[]).map((m) => (
343                      <button
344                        key={m}
345                        onClick={() => setMood(m)}
346                        className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all ${
347                          mood === m
348                            ? "bg-purple-900/40 border-purple-500 text-purple-200"
349                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
350                        }`}
351                      >
352                        {m}
353                      </button>
354                    ))}
355                  </div>
356                </div>
357
358                <div>
359                  <label className="text-xs font-semibold uppercase tracking-wider text-purple-400 block mb-1">
360                    Audience
361                  </label>
362                  <div className="grid grid-cols-2 gap-2">
363                    {(["Kids <12", "Teens", "Adults 20-40", "Mature 50+"] as Audience[]).map((a) => (
364                      <button
365                        key={a}
366                        onClick={() => setAudience(a)}
367                        className={`px-3 py-2 rounded-lg text-xs font-medium border text-left transition-all ${
368                          audience === a
369                            ? "bg-indigo-900/40 border-indigo-500 text-indigo-200"
370                            : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
371                        }`}
372                      >
373                        {a}
374                      </button>
375                    ))}
376                  </div>
377                </div>
378
379                <div>
380                  <label className="text-xs font-semibold uppercase tracking-wider text-purple-400 block mb-1">
381                    Motywy / Wspomnienia
382                  </label>
383                  <textarea
384                    value={customDetails}
385                    onChange={(e) => setCustomDetails(e.target.value)}
386                    rows={2}
387                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
388                    placeholder="Słowa klucze do zwrotki..."
389                  />
390                </div>
391
392                {/* AI Lyrics Pre-Production Button */}
393                <button
394                  onClick={handleAiWriteLyrics}
395                  disabled={isAiWriting}
396                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
397                >
398                  {isAiWriting ? (
399                    <>
400                      <Loader2 className="w-4 h-4 animate-spin" /> Pisanie słów przez AI...
401                    </>
402                  ) : (
403                    <>
404                      <Wand2 className="w-4 h-4" /> Stwórz Słowa (Przed Produkcją)
405                    </>
406                  )}
407                </button>
408              </div>
409
410              {/* Preview & Production Launcher */}
411              <div className="lg:col-span-7 flex flex-col bg-slate-950/40 p-5 rounded-xl border border-slate-800/80 justify-between space-y-4">
412                <div>
413                  <div className="flex items-center justify-between mb-3">
414                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-2">
415                      <Sparkles className="w-4 h-4 text-purple-400" /> Podgląd Tekstu dla {name}
416                    </span>
417                    <button
418                      onClick={() => setActiveTab("canvas")}
419                      className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1 font-medium"
420                    >
421                      Otwórz w Kanwie <Edit3 className="w-3.5 h-3.5" />
422                    </button>
423                  </div>
424
425                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 max-h-[260px] overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
426                    {lyricsLines.join("\n")}
427                  </div>
428                </div>
429
430                {/* Direct Production Player / Trigger */}
431                <div className="bg-slate-900/90 border border-purple-800/40 p-4 rounded-xl space-y-3">
432                  <div className="flex items-center justify-between">
433                    <span className="text-xs font-bold text-slate-200 flex items-center gap-2">
434                      <Music className="w-4 h-4 text-purple-400" /> Wyprodukowany Utwór (SDK)
435                    </span>
436                    <button
437                      onClick={handleProduceSong}
438                      disabled={isProducing}
439                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-lg shadow-purple-600/30 flex items-center gap-2 transition-all"
440                    >
441                      {isProducing ? (
442                        <>
443                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Produkcja muzyki...
444                        </>
445                      ) : (
446                        <>
447                          <Play className="w-3.5 h-3.5 fill-current" /> Wyprodukuj Utwór Now
448                        </>
449                      )}
450                    </button>
451                  </div>
452
453                  {producedClip && (
454                    <div className="pt-2 border-t border-slate-800 flex flex-col items-center gap-2">
455                      <p className="text-xs font-bold text-purple-300">{producedClip.title}</p>
456                      <audio src={producedClip.audioUrl} controls autoPlay className="w-full h-8" />
457                    </div>
458                  )}
459                </div>
460              </div>
461            </div>
462          ) : activeTab === "canvas" ? (
463            /* Interactive Lyrics Canvas */
464            <div className="space-y-4">
465              <div className="flex items-center justify-between bg-slate-950/40 p-4 rounded-xl border border-slate-800">
466                <div>
467                  <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-2">
468                    <Edit3 className="w-4 h-4" /> Interaktywna Kanwa Tekstu
469                  </h2>
470                  <p className="text-xs text-slate-400">
471                    Kliknij dowolny wers lub frazę, aby wprowadzić korektę poetycką przed produkcją muzyki.
472                  </p>
473                </div>
474                <button
475                  onClick={handleCopyText}
476                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 hover:bg-purple-600/40 text-purple-300 rounded-lg text-xs font-medium transition-all"
477                >
478                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
479                  {copied ? "Skopiowano!" : "Kopiuj tekst"}
480                </button>
481              </div>
482
483              {/* Interactive Lines List */}
484              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 max-h-[340px] overflow-y-auto space-y-1 font-mono text-xs">
485                {lyricsLines.map((line, idx) => (
486                  <div
487                    key={idx}
488                    onClick={() => {
489                      setSelectedLineIndex(idx);
490                      setEditPrompt(line);
491                    }}
492                    className={`px-3 py-1.5 rounded transition-all cursor-pointer flex items-center justify-between ${
493                      selectedLineIndex === idx
494                        ? "bg-purple-900/60 border border-purple-500 text-purple-200"
495                        : "hover:bg-slate-900 text-slate-300"
496                    }`}
497                  >
498                    <span>{line || " "}</span>
499                    {selectedLineIndex === idx && (
500                      <span className="text-[10px] text-purple-400 uppercase font-sans font-bold">Wybrany</span>
501                    )}
502                  </div>
503                ))}
504              </div>
505
506              {/* Fragment Modifier Tool */}
507              {selectedLineIndex !== null && (
508                <div className="bg-purple-950/30 border border-purple-800/60 p-4 rounded-xl space-y-3 animate-fadeIn">
509                  <div className="flex items-center justify-between">
510                    <span className="text-xs font-semibold text-purple-300">
511                      Edycja wersu #{selectedLineIndex + 1}:
512                    </span>
513                    <button
514                      onClick={() => setSelectedLineIndex(null)}
515                      className="text-xs text-slate-400 hover:text-slate-200"
516                    >
517                      Anuluj
518                    </button>
519                  </div>
520                  <input
521                    type="text"
522                    value={editPrompt}
523                    onChange={(e) => setEditPrompt(e.target.value)}
524                    className="w-full bg-slate-900 border border-purple-500/50 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none"
525                    placeholder="Wpisz zmienioną treść wersu..."
526                  />
527                  <div className="flex justify-end gap-2">
528                    <button
529                      onClick={handleApplyLineChange}
530                      className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold"
531                    >
532                      Zapisz zmianę w Kanwie
533                    </button>
534                  </div>
535                </div>
536              )}
537
538              {/* Bottom Launcher */}
539              <div className="pt-2 flex justify-end">
540                <button
541                  onClick={handleProduceSong}
542                  disabled={isProducing}
543                  className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-lg shadow-purple-600/30 flex items-center gap-2"
544                >
545                  {isProducing ? (
546                    <>
547                      <Loader2 className="w-4 h-4 animate-spin" /> Produkcja utworu w toku...
548                    </>
549                  ) : (
550                    <>
551                      <Play className="w-4 h-4 fill-current" /> Wyprodukuj Utwór z Gotowego Tekstu
552                    </>
553                  )}
554                </button>
555              </div>
556            </div>
557          ) : activeTab === "calendar" ? (
558            /* Calendar Tab */
559            <div className="space-y-6">
560              <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-800">
561                <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-2">
562                  <CalendarIcon className="w-4 h-4" /> Kalendarium Imieninowe & Sugestie
563                </h2>
564                <p className="text-xs text-slate-400 mb-4">
565                  Wybierz datę, aby sprawdzić dzisiejszych solenizantów i automatycznie wygenerować koncept piosenki.
566                </p>
567
568                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
569                  {POPULAR_NAME_DAYS.map((item) => (
570                    <button
571                      key={item.date}
572                      onClick={() => setSelectedDate(item.date)}
573                      className={`p-3 rounded-xl border text-left transition-all ${
574                        selectedDate === item.date
575                          ? "bg-purple-900/40 border-purple-500 text-purple-200"
576                          : "bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700"
577                      }`}
578                    >
579                      <span className="text-xs font-bold block text-purple-400">{item.displayDate}</span>
580                      <span className="text-[11px] truncate block text-slate-300">{item.names.join(", ")}</span>
581                    </button>
582                  ))}
583                </div>
584
585                <div className="bg-gradient-to-br from-slate-900 to-purple-950/30 border border-purple-800/40 p-5 rounded-xl space-y-4">
586                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
587                    <div>
588                      <span className="text-xs text-purple-400 font-semibold uppercase">Imieniny: {currentNameDay.displayDate}</span>
589                      <h3 className="text-lg font-bold text-slate-100">{currentNameDay.names.join(" • ")}</h3>
590                    </div>
591                    <span className="text-xs px-2.5 py-1 rounded-full bg-purple-900/60 border border-purple-700/50 text-purple-300 font-medium">
592                      Sugerowany Klimat: {currentNameDay.suggestedMood}
593                    </span>
594                  </div>
595
596                  <div>
597                    <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Poetycki Vibe Utworu</span>
598                    <p className="text-xs italic text-slate-300 bg-slate-950/50 p-2.5 rounded border border-slate-800/80">
599                      "{currentNameDay.poeticVibe}"
600                    </p>
601                  </div>
602
603                  <div>
604                    <span className="text-xs font-semibold text-slate-400 block mb-2">Wybierz imię do natychmiastowego wygenerowania piosenki:</span>
605                    <div className="flex flex-wrap gap-2">
606                      {currentNameDay.names.map((n) => (
607                        <button
608                          key={n}
609                          onClick={() => handleSelectNameDay(n, currentNameDay.suggestedMood, currentNameDay.poeticVibe)}
610                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-purple-600/20 transition-all"
611                        >
612                          Generuj dla: {n} <ArrowRight className="w-3.5 h-3.5" />
613                        </button>
614                      ))}
615                    </div>
616                  </div>
617                </div>
618              </div>
619            </div>
620          ) : (
621            /* Rhymes Database View */
622            <div className="space-y-4">
623              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800">
624                <div className="relative w-full sm:w-72">
625                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
626                  <input
627                    type="text"
628                    value={searchWord}
629                    onChange={(e) => setSearchWord(e.target.value)}
630                    placeholder="Szukaj słowa lub rymu..."
631                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-purple-500"
632                  />
633                </div>
634                <p className="text-xs text-slate-400">
635                  Baza poetyckich i dokładnych rymów dopasowanych do polskiego synth-popu.
636                </p>
637              </div>
638
639              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[420px] overflow-y-auto pr-1">
640                {filteredRhymes.map((entry, idx) => (
641                  <div key={idx} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 hover:border-slate-700 transition-all">
642                    <div className="flex items-center justify-between mb-2">
643                      <h3 className="text-base font-bold text-purple-300">{entry.word}</h3>
644                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800/50">
645                        {entry.category}
646                      </span>
647                    </div>
648
649                    <div className="space-y-2 text-xs">
650                      <div>
651                        <span className="text-slate-500 font-medium block text-[10px] uppercase">Rymy Dokładne:</span>
652                        <div className="flex flex-wrap gap-1 mt-0.5">
653                          {entry.exactRhymes.map((r, i) => (
654                            <span key={i} className="bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px]">
655                              {r}
656                            </span>
657                          ))}
658                        </div>
659                      </div>
660
661                      <div>
662                        <span className="text-slate-500 font-medium block text-[10px] uppercase">Rymy Poetyckie / Asonanse:</span>
663                        <div className="flex flex-wrap gap-1 mt-0.5">
664                          {entry.poeticRhymes.map((r, i) => (
665                            <span key={i} className="bg-purple-950/40 border border-purple-900/50 text-purple-300 px-2 py-0.5 rounded text-[11px]">
666                              {r}
667                            </span>
668                          ))}
669                        </div>
670                      </div>
671
672                      {entry.exampleLines.length > 0 && (
673                        <div className="pt-2 border-t border-slate-800/60 italic text-slate-400 text-[11px]">
674                          "{entry.exampleLines[0]}"
675                        </div>
676                      )}
677                    </div>
678                  </div>
679                ))}
680              </div>
681            </div>
682          )}
683        </div>
684      </div>
685    </div>
686  );
687}
688
