// app/index.tsx
import * as Haptics from "expo-haptics"; // optional (expo install expo-haptics)
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

type Category = { id: number; name: string };

const AMOUNTS = [5, 10, 15];
const DIFFICULTIES = ["easy", "medium", "hard"];

export default function Home() {
  const [selectedCount, setSelectedCount] = useState<number>(10);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("hard");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | "any">("any");
  const [loadingCats, setLoadingCats] = useState(false);
  const { width } = useWindowDimensions();

  // Animated bubble values: float, scale, and pulse (opacity)
  const floatVal = useRef(new Animated.Value(0)).current;
  const scaleVal = useRef(new Animated.Value(1)).current;
  const pulseVal = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // floating (translateY) animation loop
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatVal, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(floatVal, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );

    // scale gentle loop
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleVal, { toValue: 1.04, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scaleVal, { toValue: 1.0, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );

    // pulse opacity loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseVal, { toValue: 0.9, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseVal, { toValue: 0.6, duration: 2000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );

    floatLoop.start();
    scaleLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      scaleLoop.stop();
      pulseLoop.stop();
    };
  }, [floatVal, scaleVal, pulseVal]);

  // Fetch categories
  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingCats(true);
      try {
        const res = await fetch("https://opentdb.com/api_category.php");
        const json = await res.json();
        if (!active) return;
        if (json?.trivia_categories) setCategories(json.trivia_categories);
        else setCategories(null);
      } catch (e) {
        console.warn("Failed to load categories:", e);
        setCategories(null);
      } finally {
        setLoadingCats(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  // Haptic helper
  const pressWithHaptic = (fn: () => void) => {
    try {
      Haptics.selectionAsync();
    } catch {}
    fn();
  };

  function startQuiz() {
    const params: Record<string, string> = { n: String(selectedCount), difficulty: selectedDifficulty };
    if (selectedCategory !== "any") params.category = String(selectedCategory);
    router.push({ pathname: "/quiz", params });
  }

  // combined transforms for the bubble
  const translateY = floatVal.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const combinedScale = scaleVal;
  const combinedOpacity = pulseVal;

  return (
    <LinearGradient colors={["#f7eaff", "#e6cfff"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>QUIZ</Text>

        {/* Animated bubble (float + scale + pulse) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bubble,
            {
              transform: [{ translateY }, { scale: combinedScale }],
              opacity: combinedOpacity,
              width: Math.min(380, width - 36),
            },
          ]}
        />

        <View style={styles.subtitleWrap}>
          <Text style={styles.subtitle}>Dynamic Trivia</Text>
        </View>

        <View style={styles.centerControls}>
          <Text style={styles.sectionLabel}>Number of questions</Text>
          <View style={styles.amountRow}>
            {AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                activeOpacity={0.95}
                onPress={() => pressWithHaptic(() => setSelectedCount(a))}
                style={[styles.amountBtn, selectedCount === a && styles.amountBtnActive]}
              >
                <Text style={[styles.amountText, selectedCount === a && styles.amountTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: 18 }]}>Difficulty</Text>
          <View style={styles.diffRow}>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity
                key={d}
                activeOpacity={0.95}
                onPress={() => pressWithHaptic(() => setSelectedDifficulty(d))}
                style={[styles.diffBtn, selectedDifficulty === d && styles.diffBtnActive]}
              >
                <Text style={[styles.diffText, selectedDifficulty === d && styles.diffTextActive]}>
                  {d[0].toUpperCase() + d.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.catSection, { width: Math.min(760, width - 36) }]}>
          <Text style={styles.catLabel}>Category</Text>
          <View style={styles.chipsWrap}>
            <Chip label="Any" selected={selectedCategory === "any"} onPress={() => pressWithHaptic(() => setSelectedCategory("any"))} />
            {categories &&
              categories.map((c) => (
                <Chip key={c.id} label={c.name} selected={selectedCategory === c.id} onPress={() => pressWithHaptic(() => setSelectedCategory(c.id))} />
              ))}
          </View>
        </View>

        <View style={{ width: "100%", alignItems: "center", marginTop: 22 }}>
          <TouchableOpacity activeOpacity={0.95} onPress={startQuiz} style={styles.startBtn}>
            <Text style={styles.startText}>Start</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>
    </LinearGradient>
  );
}

/* Chip Component */
function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }], marginRight: 8, marginBottom: 10 }}>
      <TouchableOpacity activeOpacity={0.95} onPressIn={onPressIn} onPressOut={onPressOut} onPress={onPress} style={[styles.chip, selected && styles.chipActive]}>
        <Text numberOfLines={1} style={[styles.chipText, selected && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* Styles */
const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignItems: "center", paddingTop: 26, paddingHorizontal: 18 },
  title: { fontSize: 54, fontWeight: "900", color: "#5b2fa6" },

  bubble: {
    position: "absolute",
    top: 70,
    height: 200,
    borderRadius: 140,
    backgroundColor: "rgba(200,160,255,0.18)",
    left: 18,
    right: 18,
    alignSelf: "center",
  },

  subtitleWrap: {
    marginTop: 18,
    backgroundColor: "#ecd6ff",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 24,
  },
  subtitle: { color: "#4a2f7a", fontWeight: "700", fontSize: 16 },

  centerControls: { marginTop: 18, alignItems: "center", width: "100%" },
  sectionLabel: { color: "#5b2fa6", fontWeight: "700", marginBottom: 8 },

  amountRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  amountBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fff",
    marginHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  amountBtnActive: { backgroundColor: "#8a4bff" },
  amountText: { fontWeight: "800", color: "#2b1b4a" },
  amountTextActive: { color: "#fff" },

  diffRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  diffBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "#fff",
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: "#efe6ff",
  },
  diffBtnActive: { backgroundColor: "#8a4bff", borderColor: "#8a4bff" },
  diffText: { fontWeight: "700", color: "#2b1b4a" },
  diffTextActive: { color: "#fff" },

  catSection: { marginTop: 22, width: "100%" },
  catLabel: { color: "#5b2fa6", fontWeight: "700", marginBottom: 8, alignSelf: "flex-start" },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    paddingHorizontal: 6,
  },

  chip: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#efe6ff",
    minWidth: 0,
    alignItems: "center",
  },
  chipActive: { backgroundColor: "#8a4bff", borderColor: "#8a4bff" },
  chipText: { color: "#2b1b4a", fontSize: 13, paddingHorizontal: 4 },
  chipTextActive: { color: "#fff", fontWeight: "700" },

  startBtn: {
    marginTop: 12,
    backgroundColor: "#b88bff",
    borderRadius: 28,
    paddingHorizontal: 40,
    paddingVertical: 12,
  },
  startText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
