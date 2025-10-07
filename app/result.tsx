// app/result.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Result() {
  // params passed from quiz: score and total (strings)
  const { score: sscore, total: stotal } = useLocalSearchParams<{ score?: string; total?: string }>();
  const score = Number(sscore ?? 0);
  const total = Number(stotal ?? 0);

  const [best, setBest] = useState<number | null>(null);
  const [message, setMessage] = useState<string>("Great job!");
  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // animation: scale in, then subtle bounce
    Animated.sequence([
      Animated.timing(scale, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1.08, friction: 3, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();

    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    // set motivational message
    const pct = total > 0 ? (score / total) * 100 : 0;
    if (pct === 100) setMessage("Perfect! 🎉");
    else if (pct >= 80) setMessage("Amazing! 🚀");
    else if (pct >= 50) setMessage("Nice effort! 👍");
    else setMessage("Keep practicing! 💪");

    // read best score
    (async () => {
      try {
        const b = await AsyncStorage.getItem("bestScore");
        const bestNum = b ? Number(b) : null;
        setBest(bestNum);
      } catch (e) {
        setBest(null);
      }
    })();
  }, []);

  const onShare = async () => {
    try {
      const text = `I scored ${score}/${total} on Mini Quiz! ${message} Can you beat me?`;
      const result = await Share.share(
        {
          title: "My quiz score",
          message: text,
          url: Platform.OS === "web" ? undefined : undefined,
        },
        { dialogTitle: "Share your score" }
      );
      // result.action indicates share success or dismissed, but no further handling needed
    } catch (error) {
      // ignore
    }
  };

  const onPlayAgain = () => {
    // start fresh quiz (navigates to quiz root)
    // If you want to preserve number-of-questions chosen previously, pass params here
    router.replace("/quiz");
  };

  const onHome = () => {
    router.replace("/");
  };

  return (
    <LinearGradient colors={["#f7eaff", "#e6cfff"]} style={styles.container}>
      <View style={styles.wrapper}>
        <Animated.View style={[styles.card, { opacity: fade }]}>
          <Animated.Text
            style={[
              styles.score,
              { transform: [{ scale }] },
            ]}
          >
            {score} / {total}
          </Animated.Text>

          <Text style={styles.smallText}>Your score</Text>

          <Text style={styles.message}>{message}</Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>Best score: <Text style={{ fontWeight: "800" }}>{best ?? "-"}</Text></Text>
            <Text style={styles.metaText}>•</Text>
            <Text style={styles.metaText}>Questions: <Text style={{ fontWeight: "800" }}>{total}</Text></Text>
          </View>

          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
              <Text style={styles.shareText}>Share Score</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.playBtn} onPress={onPlayAgain}>
              <Text style={styles.playText}>Play Again</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.homeBtn} onPress={onHome}>
            <Text style={styles.homeText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.tipBox, { opacity: fade }]}>
          <Text style={styles.tipTitle}>Quick tips</Text>
          <Text style={styles.tipText}>• Review common facts after each round</Text>
          <Text style={styles.tipText}>• Try shorter timers for a challenge</Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wrapper: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 },
  card: {
    width: "100%",
    maxWidth: 520,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  score: { fontSize: 42, fontWeight: "900", color: "#5b2fa6" },
  smallText: { marginTop: 6, color: "#5b2fa6" },
  message: { marginTop: 10, fontSize: 18, fontWeight: "700", color: "#3b1f6a" },
  metaRow: { flexDirection: "row", marginTop: 12, alignItems: "center", gap: 8 },
  metaText: { color: "#5b2fa6", marginHorizontal: 8 },

  buttonsRow: { flexDirection: "row", marginTop: 18, width: "100%", justifyContent: "center", gap: 12 },

  shareBtn: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#e8d9ff",
    elevation: 2,
  },
  shareText: { color: "#5b2fa6", fontWeight: "800" },

  playBtn: {
    backgroundColor: "#b88bff",
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 24,
  },
  playText: { color: "#fff", fontWeight: "800" },

  homeBtn: {
    marginTop: 12,
    backgroundColor: "#f0e7ff",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 24,
  },
  homeText: { color: "#5b2fa6", fontWeight: "700" },

  tipBox: {
    marginTop: 18,
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#faf2ff",
    padding: 14,
    borderRadius: 14,
  },
  tipTitle: { fontWeight: "800", color: "#5b2fa6", marginBottom: 6 },
  tipText: { color: "#5b2fa6", opacity: 0.9, marginTop: 4 },
});
