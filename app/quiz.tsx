// app/quiz.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import he from "he";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Header";
import OptionRow from "../components/OptionRow";
import useTimer from "../hooks/useTimer";

type QuestionShape = {
  id: string;
  text: string;
  choices: string[];
  answerIndex: number;
  hint?: string; // meta (category/difficulty)
  explanation?: string;
};

const QUESTION_TIME = 15;

function shuffleArray<T>(arr: T[]) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- HINT HELPERS ---------- */
function maskAnswer(answer: string) {
  const words = answer.trim().split(/\s+/);
  return words
    .map((w) => {
      if (w.length <= 2) return w[0] + "_".repeat(Math.max(0, w.length - 1));
      const reveal = Math.max(1, Math.floor(w.length / 3));
      let out = "";
      for (let i = 0; i < w.length; i++) out += i < reveal ? w[i] : "_";
      return out;
    })
    .join(" ");
}

function categoryClue(meta: string | undefined) {
  if (!meta) return "Use context from the category to help narrow the answer.";
  const lower = meta.toLowerCase();
  if (lower.includes("science") || lower.includes("physics") || lower.includes("biology"))
    return "This is a scientific fact — think physical or natural properties.";
  if (lower.includes("history") || lower.includes("politics")) return "Think about the era or the prominent figure.";
  if (lower.includes("geography")) return "Think in terms of countries, continents or capitals.";
  if (lower.includes("video") || lower.includes("games") || lower.includes("entertainment"))
    return "This relates to pop culture — likely short and informal.";
  if (lower.includes("general")) return "This is general-knowledge — common trivia.";
  return `Category hint: ${meta}`;
}

function eliminationClue(options: string[], answerIndex: number) {
  const dateLike = options.map((o, i) => ({ o, i })).find((c) => /\d{4}/.test(c.o));
  if (dateLike && dateLike.i !== answerIndex) return `Elimination: ${dateLike.o} is a date — check timeline.`;
  const sortedByLen = options.map((o, i) => ({ o, i })).sort((a, b) => b.o.length - a.o.length);
  const pick = sortedByLen[0];
  if (pick.i !== answerIndex) return `Elimination hint: ${pick.o} looks stylistically different — consider excluding it.`;
  return "Eliminate choices that don't match the question keywords.";
}

function getSmartHint(current: QuestionShape) {
  const correct = current.choices[current.answerIndex];
  const meta = current.hint ?? "";
  const variants = [
    `Answer pattern: ${maskAnswer(correct)}`,
    `${categoryClue(meta)}\nPattern: ${maskAnswer(correct)}`,
    eliminationClue(current.choices, current.answerIndex),
  ];
  let seed = 0;
  for (let i = 0; i < current.id.length; i++) seed += current.id.charCodeAt(i);
  return variants[seed % variants.length];
}

/* ---------- EXPLANATION HELPERS (WIKI + DDG + FALLBACK) ---------- */

async function wikiSummaryForTitle(title: string) {
  try {
    const encoded = encodeURIComponent(title.replace(/\s+/g, "_"));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    console.log("[wikiSummaryForTitle] requesting:", url);
    const r = await fetch(url);
    if (!r.ok) {
      console.log("[wikiSummaryForTitle] not ok:", r.status);
      return null;
    }
    const j = await r.json();
    if (j && (j.extract || j.description)) {
      return {
        extract: j.extract ?? j.description,
        pageUrl: j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`,
      };
    }
    return null;
  } catch (e) {
    console.log("[wikiSummaryForTitle] error:", e);
    return null;
  }
}

async function wikiSearchTopTitle(query: string) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&utf8=&format=json&origin=*`;
    console.log("[wikiSearchTopTitle] requesting:", url);
    const r = await fetch(url);
    if (!r.ok) {
      console.log("[wikiSearchTopTitle] not ok:", r.status);
      return null;
    }
    const j = await r.json();
    const results = j?.query?.search;
    if (Array.isArray(results) && results.length > 0) return results[0].title as string;
    return null;
  } catch (e) {
    console.log("[wikiSearchTopTitle] error:", e);
    return null;
  }
}

async function duckDuckGoInstant(q: string) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    console.log("[duckDuckGoInstant] requesting:", url);
    const r = await fetch(url);
    if (!r.ok) {
      console.log("[duckDuckGoInstant] not ok:", r.status);
      return null;
    }
    const j = await r.json();
    if (j?.AbstractText && j.AbstractText.trim().length > 0) return { text: j.AbstractText, url: j.AbstractURL || null };
    if (Array.isArray(j?.RelatedTopics) && j.RelatedTopics.length > 0) {
      const t = j.RelatedTopics[0];
      const txt = t?.Text || (t?.Topics && t.Topics[0]?.Text);
      if (txt) return { text: txt, url: j.AbstractURL || null };
    }
    console.log("[duckDuckGoInstant] no useful abstract");
    return null;
  } catch (e) {
    console.log("[duckDuckGoInstant] error:", e);
    return null;
  }
}

/* ---------- COMPONENT ---------- */

export default function Quiz() {
  const params = useLocalSearchParams<{ n?: string; difficulty?: string; category?: string }>();
  const requested = params.n ? parseInt(params.n as any, 10) : 10;
  const difficulty = (params.difficulty as string) || "hard";
  const categoryParam = params.category ? String(params.category) : undefined;
  const amount = Math.min(Math.max(1, requested || 10), 50);

  // hooks (always declared)
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<QuestionShape[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showHintMap, setShowHintMap] = useState<Record<string, boolean>>({});
  const [explanationText, setExplanationText] = useState<string | null>(null);
  const [explanationUrl, setExplanationUrl] = useState<string | null>(null);
  const [explanationLoading, setExplanationLoading] = useState(false);

  const { remaining, reset } = useTimer(QUESTION_TIME, !answered);

  const progress = useRef(new Animated.Value(1)).current;
  const explainAnim = useRef(new Animated.Value(0)).current;

  const cacheKey = `trivia_${amount}_${difficulty}_${categoryParam ?? "any"}`;

  // Fetch questions (OpenTDB) + cache fallback
  useEffect(() => {
    let active = true;
    async function fetchAndCache() {
      setLoading(true);
      try {
        const base = `https://opentdb.com/api.php?amount=${amount}&difficulty=${difficulty}&type=multiple`;
        const url = categoryParam ? `${base}&category=${categoryParam}` : base;
        const res = await fetch(url);
        const json = await res.json();

        if (!active) return;

        if (json.response_code === 0 && Array.isArray(json.results)) {
          const converted: QuestionShape[] = json.results.map((r: any, i: number) => {
            const correct = he.decode(String(r.correct_answer));
            const incorrects = (r.incorrect_answers || []).map((s: string) => he.decode(String(s)));
            const all = shuffleArray([correct, ...incorrects]);
            const answerIndex = all.findIndex((x) => x === correct);
            const text = he.decode(String(r.question));
            const hintMeta = `${r.category} • ${r.difficulty}`;
            return { id: `api-${i}-${Date.now()}`, text, choices: all, answerIndex, hint: hintMeta };
          });

          setQuestions(converted);
          setShowHintMap(converted.reduce((acc, q) => ({ ...acc, [q.id]: false }), {}));
          await AsyncStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: converted }));
        } else {
          throw new Error("Invalid response");
        }
      } catch (err) {
        console.warn("Fetch failed, trying cache:", err);
        try {
          const cached = await AsyncStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            const data = parsed.data ?? parsed;
            setQuestions(data);
            setShowHintMap(data.reduce((acc: any, q: any) => ({ ...acc, [q.id]: false }), {}));
          } else {
            const fallback: QuestionShape[] = [
              {
                id: "fallback-1",
                text: "Fallback: Which planet is the smallest?",
                choices: ["Pluto", "Earth", "Mercury", "Mars"],
                answerIndex: 2,
                hint: "Astronomy • classical planets",
                explanation: "Mercury is the smallest planet in the Solar System (excluding dwarf planets such as Pluto).",
              },
            ];
            setQuestions(fallback);
            setShowHintMap(fallback.reduce((acc, q) => ({ ...acc, [q.id]: false }), {}));
          }
        } catch (ce) {
          console.warn("Cache read failed:", ce);
          const fallback: QuestionShape[] = [
            {
              id: "fallback-1",
              text: "Fallback: Which planet is the smallest?",
              choices: ["Pluto", "Earth", "Mercury", "Mars"],
              answerIndex: 2,
              hint: "Astronomy • classical planets",
              explanation: "Mercury is the smallest planet in the Solar System (excluding dwarf planets such as Pluto).",
            },
          ];
          setQuestions(fallback);
          setShowHintMap(fallback.reduce((acc, q) => ({ ...acc, [q.id]: false }), {}));
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchAndCache();
    return () => {
      active = false;
    };
  }, [amount, difficulty, categoryParam]);

  // Progress animation reset per question
  useEffect(() => {
    progress.setValue(1);
    Animated.timing(progress, { toValue: 0, duration: QUESTION_TIME * 1000, useNativeDriver: false }).start();
  }, [index]);

  // Auto-submit when timer ends
  useEffect(() => {
    if (remaining === 0 && !answered) submit(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  if (loading || !questions) {
    return (
      <LinearGradient colors={["#f7eaff", "#e6cfff"]} style={styles.container}>
        <SafeAreaView style={styles.centered}>
          <ActivityIndicator size="large" color="#8a4bff" />
          <Text style={{ color: "#5b2fa6", marginTop: 12 }}>Loading questions...</Text>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const current = questions[index];

  // Robust explanation fetch: many candidates, wiki -> search -> ddg -> fallback
  async function fetchExplanationFor(correctAnswer: string) {
    setExplanationLoading(true);
    setExplanationText(null);
    setExplanationUrl(null);

    async function tryCandidate(candidate: string) {
      if (!candidate || candidate.trim().length === 0) return false;

      // 1) direct wiki summary
      try {
        const wikiDirect = await wikiSummaryForTitle(candidate);
        if (wikiDirect && wikiDirect.extract) {
          console.log("[fetchExplanationFor] wikiDirect success for:", candidate);
          setExplanationText(wikiDirect.extract);
          setExplanationUrl(wikiDirect.pageUrl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(candidate.replace(/\s+/g, "_"))}`);
          return true;
        }
      } catch (e) {
        // continue
      }

      // 2) duckduckgo
      try {
        const ddg = await duckDuckGoInstant(candidate);
        if (ddg && ddg.text) {
          console.log("[fetchExplanationFor] ddg success for:", candidate);
          setExplanationText(ddg.text);
          setExplanationUrl(ddg.url ?? `https://duckduckgo.com/?q=${encodeURIComponent(candidate)}`);
          return true;
        }
      } catch (e) {
        // continue
      }

      // 3) wiki search -> summary
      try {
        const topTitle = await wikiSearchTopTitle(candidate);
        if (topTitle) {
          const wikiFromSearch = await wikiSummaryForTitle(topTitle);
          if (wikiFromSearch && wikiFromSearch.extract) {
            console.log("[fetchExplanationFor] wikiSearch success for:", candidate, "->", topTitle);
            setExplanationText(wikiFromSearch.extract);
            setExplanationUrl(wikiFromSearch.pageUrl ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(topTitle.replace(/\s+/g, "_"))}`);
            return true;
          }
        }
      } catch (e) {
        // continue
      }

      return false;
    }

    // build candidate list
    const candidates: string[] = [];
    candidates.push(correctAnswer);
    candidates.push(correctAnswer.replace(/\s*\(.*?\)\s*/g, "").trim());
    candidates.push(correctAnswer.replace(/['"“”’]/g, "").trim());
    candidates.push(current.text);
    candidates.push(`${correctAnswer} ${current.text}`);
    candidates.push(current.text.split(/\s+/).slice(0, 3).join(" "));
    candidates.push(correctAnswer.split(/\s+/).slice(0, 2).join(" "));
    const uniq = Array.from(new Set(candidates.filter(Boolean)));
    console.log("[fetchExplanationFor] candidates:", uniq);

    let found = false;
    for (const cand of uniq) {
      try {
        const ok = await tryCandidate(cand);
        if (ok) {
          found = true;
          break;
        }
      } catch (e) {
        console.log("[fetchExplanationFor] candidate error:", cand, e);
      }
    }

    if (!found) {
      console.log("[fetchExplanationFor] no external summary found, using fallback.");
      const fallback = `Correct answer: ${correctAnswer}. (Category/difficulty: ${current.hint ?? difficulty})`;
      setExplanationText(fallback);
      setExplanationUrl(`https://www.google.com/search?q=${encodeURIComponent(current.text)}`);
    }

    setExplanationLoading(false);
  }

  function showExplanation() {
    explainAnim.setValue(0);
    Animated.timing(explainAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }
  function hideExplanation() {
    Animated.timing(explainAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start();
  }

  const submit = (sel: number | null) => {
    if (answered) return;
    const correct = sel === current.answerIndex;
    if (correct) setScore((s) => s + 1);
    setAnswered(true);

    const correctAnswer = current.choices[current.answerIndex];
    fetchExplanationFor(correctAnswer).catch((e) => console.warn(e));

    setTimeout(() => showExplanation(), 300);
  };

  const next = async () => {
    hideExplanation();
    setTimeout(async () => {
      if (index + 1 < questions.length) {
        setIndex((i) => i + 1);
        setSelected(null);
        setAnswered(false);
        setExplanationText(null);
        setExplanationUrl(null);
        setExplanationLoading(false);
        reset();
      } else {
        const best = Number((await AsyncStorage.getItem("bestScore")) || 0);
        if (score > best) await AsyncStorage.setItem("bestScore", String(score));
        router.replace({ pathname: "/result", params: { score, total: questions.length } });
      }
    }, 180);
  };

  const revealHint = () => setShowHintMap((m) => ({ ...m, [current.id]: true }));

  const onReadMore = async () => {
    const url = explanationUrl ?? `https://www.google.com/search?q=${encodeURIComponent(current.text)}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      console.warn("Could not open URL", e);
    }
  };

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  return (
    <LinearGradient colors={["#f7eaff", "#e6cfff"]} style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 10 }}>
          <Header title={`Q${index + 1} / ${questions.length}`} subtitle={`Time: ${remaining}s`} />

          <View style={styles.timerWrap}>
            <Animated.View style={[styles.timerBar, { width: progressWidth }]} />
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
            <View style={styles.questionBox}>
              <Text style={styles.questionText}>{current.text}</Text>
            </View>

            <View style={styles.metaRow}>
              {current.hint ? <Text style={styles.metaChip}>{current.hint}</Text> : null}
            </View>

            <View style={styles.hintRow}>
              {!showHintMap[current.id] ? (
                <TouchableOpacity style={styles.hintBtn} onPress={revealHint}>
                  <Text style={styles.hintBtnText}>Show Hint</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.hintCard}>
                  <Text style={styles.hintText}>{getSmartHint(current)}</Text>
                </View>
              )}
            </View>

            <View style={{ marginTop: 12 }}>
              {current.choices.map((c, i) => {
                const state =
                  answered && i === current.answerIndex
                    ? "correct"
                    : answered && i === selected && i !== current.answerIndex
                    ? "wrong"
                    : !answered && i === selected
                    ? "selected"
                    : "normal";

                return (
                  <OptionRow
                    key={i}
                    label={`${String.fromCharCode(65 + i)}. ${c}`}
                    onPress={() => {
                      if (!answered) setSelected(i);
                    }}
                    disabled={answered}
                    state={state as any}
                  />
                );
              })}
            </View>

            {answered ? (
              <Animated.View
                pointerEvents="box-none"
                style={[
                  styles.explainWrap,
                  {
                    opacity: explainAnim,
                    transform: [
                      {
                        translateY: explainAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.explainCard}>
                  <Text style={styles.explainTitle}>Explanation</Text>

                  {explanationLoading ? (
                    <View style={{ paddingVertical: 12, alignItems: "center" }}>
                      <ActivityIndicator color="#8a4bff" />
                      <Text style={{ color: "#5b2fa6", marginTop: 8 }}>Fetching background...</Text>
                    </View>
                  ) : (
                    <Text style={styles.explainText}>
                      {explanationText ?? `Correct answer: ${current.choices[current.answerIndex]}.`}
                    </Text>
                  )}

                  <View style={styles.explainButtons}>
                    <TouchableOpacity style={styles.linkBtn} onPress={onReadMore}>
                      <Text style={styles.linkText}>Read more</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.nextBtn} onPress={next}>
                      <Text style={styles.nextBtnText}>{index + 1 === questions.length ? "Finish" : "Next"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.quit}
              onPress={() =>
                Alert.alert("Quit", "Abort quiz and go back to Home?", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Yes", onPress: () => router.replace("/") },
                ])
              }
            >
              <Text style={{ fontWeight: "700", color: "#2b1b4a" }}>Quit</Text>
            </TouchableOpacity>

            {!answered ? (
              <TouchableOpacity
                style={[styles.actionBtn, selected === null && styles.disabledBtn]}
                disabled={selected === null}
                onPress={() => submit(selected)}
              >
                <Text style={styles.actionText}>Submit</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.actionBtn, { opacity: 0.7 }]}>
                <Text style={styles.actionText}>Answered</Text>
              </View>
            )}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  timerWrap: {
    height: 8,
    backgroundColor: "#efe6ff",
    marginHorizontal: 16,
    borderRadius: 8,
    overflow: "hidden",
  },
  timerBar: { height: "100%", backgroundColor: "#8a4bff" },
  questionBox: {
    backgroundColor: "#ecd6ff",
    padding: 16,
    borderRadius: 18,
    marginTop: 12,
    marginHorizontal: 6,
  },
  questionText: { fontSize: 18, fontWeight: "700", color: "#2b1b4a" },

  metaRow: { marginTop: 8, paddingHorizontal: 6 },
  metaChip: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#efe6ff",
    color: "#5b2fa6",
  },

  hintRow: { marginTop: 12, alignItems: "flex-start", paddingHorizontal: 6 },
  hintBtn: {
    backgroundColor: "#fff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6d9ff",
  },
  hintBtnText: { color: "#5b2fa6", fontWeight: "700" },
  hintCard: {
    backgroundColor: "#faf2ff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#efe6ff",
  },
  hintText: { color: "#4a2f7a" },

  explainWrap: { marginTop: 18, paddingHorizontal: 6 },
  explainCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#efe6ff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  explainTitle: { fontWeight: "800", color: "#5b2fa6", marginBottom: 8 },
  explainText: { color: "#333", lineHeight: 20 },

  explainButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    alignItems: "center",
  },
  linkBtn: {
    backgroundColor: "#faf2ff",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#efe6ff",
  },
  linkText: { color: "#5b2fa6", fontWeight: "700" },
  nextBtn: {
    backgroundColor: "#b88bff",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  nextBtnText: { color: "#fff", fontWeight: "800" },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    alignItems: "center",
  },
  actionBtn: {
    backgroundColor: "#b88bff",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 28,
    minWidth: 110,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "800" },
  disabledBtn: { backgroundColor: "#d8c6ff" },
  quit: { paddingVertical: 6, paddingHorizontal: 10 },
});
