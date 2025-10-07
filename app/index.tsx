// app/index.tsx
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

type Category = { id: number; name: string };

const AMOUNTS = [5, 10, 15];
const DIFFICULTIES = ["easy", "medium", "hard"];

export default function Home() {
  const [selectedCount, setSelectedCount] = useState<number>(10);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("hard");
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | "any">("any");
  const [loadingCats, setLoadingCats] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let active = true;
    async function loadCats() {
      setLoadingCats(true);
      try {
        const res = await fetch("https://opentdb.com/api_category.php");
        const json = await res.json();
        if (!active) return;
        if (json.trivia_categories && Array.isArray(json.trivia_categories)) {
          setCategories(json.trivia_categories);
        } else {
          setCategories(null);
        }
      } catch (e) {
        console.warn("Failed to load categories:", e);
        setCategories(null);
      } finally {
        setLoadingCats(false);
      }
    }
    loadCats();
    return () => {
      active = false;
    };
  }, []);

  function startQuiz() {
    const params: Record<string, string> = {
      n: String(selectedCount),
      difficulty: selectedDifficulty,
    };
    if (selectedCategory !== "any") params.category = String(selectedCategory);
    router.push({ pathname: "/quiz", params });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8ecff" }}>
      <LinearGradient colors={["#f8ecff", "#efe1ff"]} style={styles.container}>
        <ScrollView
          contentContainerStyle={{
            alignItems: "center",
            paddingHorizontal: 16,
            // make header a bit higher while still keeping safe-area
            paddingTop: (insets.top || 0) + 2,
            paddingBottom: 60,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Bubble Header (raised slightly) */}
          <LinearGradient
            colors={["#f3dfff", "#ebc8ff"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.bubbleHeader, { marginTop: -5 }]}
          >
            <Text style={styles.big}>QUIZ</Text>

            <View style={styles.innerBubble}>
              <Text style={styles.subtitle}>Dynamic Trivia</Text>
            </View>
          </LinearGradient>

          {/* Number of Questions */}
          <Text style={styles.label}>Number of questions</Text>
          <View style={styles.row}>
            {AMOUNTS.map((a) => (
              <TouchableOpacity
                key={a}
                onPress={() => setSelectedCount(a)}
                style={[
                  styles.countBtn,
                  selectedCount === a && styles.countBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    selectedCount === a && styles.countTextActive,
                  ]}
                >
                  {a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Difficulty */}
          <Text style={[styles.label, { marginTop: 16 }]}>Difficulty</Text>
          <View style={styles.row}>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity
                key={d}
                onPress={() => setSelectedDifficulty(d)}
                style={[
                  styles.countBtn,
                  selectedDifficulty === d && styles.countBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.countText,
                    selectedDifficulty === d && styles.countTextActive,
                  ]}
                >
                  {d[0].toUpperCase() + d.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category */}
          <Text style={[styles.label, { marginTop: 16, alignSelf: "flex-start" }]}>
            Category
          </Text>
          {loadingCats ? (
            <ActivityIndicator color="#8a4bff" style={{ marginTop: 8 }} />
          ) : categories ? (
            <View style={styles.categoriesWrap}>
              <View style={styles.categoriesRow}>
                <TouchableOpacity
                  style={[
                    styles.catBtn,
                    selectedCategory === "any" && styles.catBtnActive,
                  ]}
                  onPress={() => setSelectedCategory("any")}
                >
                  <Text
                    style={[
                      styles.catText,
                      selectedCategory === "any" && styles.catTextActive,
                    ]}
                  >
                    Any
                  </Text>
                </TouchableOpacity>

                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.catBtn,
                      selectedCategory === c.id && styles.catBtnActive,
                    ]}
                    onPress={() => setSelectedCategory(c.id)}
                  >
                    <Text
                      style={[
                        styles.catText,
                        selectedCategory === c.id && styles.catTextActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <Text style={{ marginTop: 8, color: "#5b2fa6" }}>
              Couldn't load categories — defaulting to Any.
            </Text>
          )}

          {/* Start Button */}
          <TouchableOpacity style={styles.startBtn} onPress={startQuiz}>
            <Text style={styles.startText}>Start</Text>
          </TouchableOpacity>

          <View style={{ height: 60 }} />
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  bubbleHeader: {
    width: "100%",
    borderRadius: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 22, // slightly smaller so it sits higher
    marginBottom: 18,
  },
  innerBubble: {
    backgroundColor: "#f0d9ff",
    borderRadius: 50,
    paddingVertical: 5,
    paddingHorizontal: 14,
    marginTop: 6,
  },
  big: {
    fontSize: 50,
    fontWeight: "900",
    color: "#5b2fa6",
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#5b2fa6",
  },

  label: { marginTop: 8, color: "#5b2fa6", fontWeight: "700", fontSize: 16 },
  row: { flexDirection: "row", marginTop: 8, justifyContent: "center" },

  countBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: "#fff",
    marginHorizontal: 6,
    shadowColor: "#8a4bff",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  countBtnActive: {
    backgroundColor: "#8a4bff",
    shadowOpacity: 0.3,
  },
  countText: { fontWeight: "700", color: "#2b1b4a" },
  countTextActive: { color: "#fff" },

  categoriesWrap: { width: "100%", marginTop: 8 },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  catBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#efe6ff",
    margin: 6,
    shadowColor: "#8a4bff",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  catBtnActive: { backgroundColor: "#8a4bff", borderColor: "#8a4bff" },
  catText: { color: "#2b1b4a", fontSize: 13, fontWeight: "500" },
  catTextActive: { color: "#fff", fontWeight: "700" },

  startBtn: {
    marginTop: 26,
    backgroundColor: "#b88bff",
    borderRadius: 28,
    paddingHorizontal: 36,
    paddingVertical: 12,
    shadowColor: "#8a4bff",
    shadowOpacity: 0.4,
    elevation: 4,
  },
  startText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
