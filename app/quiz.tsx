// app/quiz.tsx
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import ExplanationCard from "../components/ExplanationCard";

export default function QuizScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const numQuestions = Number((params as any).n || 10);
  const difficulty = (params as any).difficulty || "hard";
  const category = (params as any).category || null;

  const insets = useSafeAreaInsets();

  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        let url = `https://opentdb.com/api.php?amount=${numQuestions}&difficulty=${difficulty}&type=multiple`;
        if (category && category !== "any") url += `&category=${category}`;
        const res = await fetch(url);
        const json = await res.json();
        if (active && json?.results) setQuestions(json.results);
      } catch (e) {
        console.error("Failed to load questions", e);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const currentQuestion = questions[currentIndex];

  // select an option (do NOT auto-submit)
  const handleSelect = (answer: string) => {
    setSelectedAnswer((prev) => (prev === answer ? null : answer));
    if (Platform.OS !== "web") {
      try {
        Haptics.selectionAsync();
      } catch {}
    }
  };

  // submit answer -> evaluate & reveal explanation
  const handleSubmit = () => {
    if (!selectedAnswer || submitted || !currentQuestion) return;
    const correct = selectedAnswer === currentQuestion.correct_answer;
    if (correct) setScore((s) => s + 1);
    setSubmitted(true);
  };

  // called from ExplanationCard Next
  const handleNext = () => {
    const next = currentIndex + 1;
    if (next < questions.length) {
      setCurrentIndex(next);
      setSelectedAnswer(null);
      setSubmitted(false);
    } else {
      router.push({
        pathname: "/result",
        params: { score: String(score), total: String(questions.length) },
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8a4bff" />
      </View>
    );
  }

  if (!currentQuestion) {
    return (
      <View style={styles.center}>
        <Text>No questions available. Try different settings.</Text>
      </View>
    );
  }

  const allAnswers = shuffle([
    currentQuestion.correct_answer,
    ...currentQuestion.incorrect_answers,
  ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8ecff" }}>
      <LinearGradient colors={["#f8ecff", "#efe1ff"]} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: (insets.top || 12) + 8,
            paddingBottom: (insets.bottom || 18) + 140,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* header: Q count + timer */}
          <View style={{ marginBottom: 8 }}>
            <View style={[styles.top, { marginTop: 0 }]}>
              <View style={[styles.qCountWrap]}>
                <Text style={styles.qCount}>
                  Q{currentIndex + 1} / {questions.length}
                </Text>
              </View>
              <Text style={styles.timer}>Time: 15s</Text>
            </View>
          </View>

          {/* question */}
          <View>
            <Text style={styles.question}>{decodeHTML(currentQuestion.question)}</Text>

            <View style={styles.meta}>
              <Text style={styles.metaText}>
                {currentQuestion.category} • {difficulty}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.hintBtn}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // implement hint toggling if you want — placeholder
                // e.g. setHintVisible(true)
              }}
            >
              <Text style={styles.hintText}>Show Hint</Text>
            </TouchableOpacity>
          </View>

          {/* options */}
          <View style={{ marginTop: 14 }}>
            {allAnswers.map((ans, i) => {
              const decoded = decodeHTML(ans);
              const isSelected = selectedAnswer === ans;
              const isCorrect = submitted && ans === currentQuestion.correct_answer;
              const isWrong = submitted && isSelected && ans !== currentQuestion.correct_answer;

              let bg = "#fff";
              if (isCorrect) bg = "#16a34a"; // green
              else if (isWrong) bg = "#ef4444"; // red
              else if (isSelected) bg = "#efe1ff"; // selected color

              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleSelect(ans)}
                  activeOpacity={0.85}
                  style={[
                    styles.option,
                    { backgroundColor: bg, borderColor: isSelected ? "#8a4bff" : "#d4bfff" },
                  ]}
                >
                  <View style={styles.bullet}>
                    <Text style={styles.bulletText}>{String.fromCharCode(65 + i)}</Text>
                  </View>
                  <Text style={styles.optionText}>{decoded}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* explanation appears only after submit */}
          {submitted && (
            <ExplanationCard
              question={decodeHTML(currentQuestion.question)}
              answer={decodeHTML(currentQuestion.correct_answer)}
              visible={submitted}
              onNext={handleNext}
            />
          )}
        </ScrollView>

        {/* fixed footer; position above bottom safe inset */}
        <View style={[styles.fixedFooter, { bottom: (insets.bottom || 18) + 8 }]}>
          <TouchableOpacity onPress={() => router.push("/")} style={styles.quitBtn}>
            <Text style={styles.quitText}>Quit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.submitBtn, { opacity: selectedAnswer && !submitted ? 1 : 0.5 }]}
            disabled={!selectedAnswer || submitted}
          >
            <Text style={styles.submitText}>
              {currentIndex + 1 === questions.length ? "Finish" : "Submit"}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

/* helpers */
function decodeHTML(str: string) {
  if (!str) return "";
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&rsquo;/g, "’")
    .replace(/&hellip;/g, "…");
}

function shuffle<T>(array: T[]) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* styles */
const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  qCountWrap: {
    backgroundColor: "#efe1ff",
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 24,
    alignSelf: "flex-start",
  },
  qCount: { fontWeight: "800", color: "#5b2fa6", fontSize: 16 },
  timer: { fontWeight: "600", color: "#7b4cff", fontSize: 14 },

  question: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2b1b4a",
    marginBottom: 12,
    lineHeight: 24,
  },
  meta: {
    marginTop: 6,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#efe6ff",
  },
  metaText: { color: "#6a3fbf", fontWeight: "600" },

  hintBtn: {
    marginTop: 10,
    backgroundColor: "#efe6ff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  hintText: { color: "#6a3fbf", fontWeight: "700" },

  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginVertical: 8,
    borderWidth: 1,
  },
  bullet: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#efe6ff",
  },
  bulletText: { fontWeight: "800", color: "#4a3b7a" },
  optionText: { fontSize: 16, fontWeight: "600", color: "#2b1b4a" },

  fixedFooter: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  quitText: {
    color: "#2b1b4a",
    fontWeight: "700",
  },
  submitBtn: {
    backgroundColor: "#b88bff",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 28,
    shadowColor: "#8a4bff",
    shadowOpacity: 0.16,
    elevation: 2,
  },
  submitText: { color: "#fff", fontWeight: "800" },
});
