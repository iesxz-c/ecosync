import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import * as Haptics from "expo-haptics";
import Ionicons from "@expo/vector-icons/Ionicons";

function TabButton(props: any) {
  const { onPress, accessibilityState } = props;
  const focused = accessibilityState?.selected;

  return (
    <Pressable
      {...props}
      onPress={(e) => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.tabButton,
        pressed && styles.tabPressed,
        focused && styles.tabFocused,
      ]}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: "#111827",
        tabBarInactiveTintColor: "#6B7280",

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
          marginTop: 2,
        },

        tabBarStyle: {
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 14,
          height: 64,
          backgroundColor: "#f0eeee", // solid white
          borderTopWidth: 0,
          borderRadius: 22,

          // iOS shadow
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 16,

          // Android shadow
          elevation: 8,
        },

        tabBarButton: (props) => <TabButton {...props} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={size ?? 24}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="analysis"
        options={{
          title: "Analysis",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
              <Ionicons
                name={focused ? "analytics" : "analytics-outline"}
                size={size ?? 24}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="bills"
        options={{
          title: "Bills",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
              <Ionicons
                name={focused ? "receipt" : "receipt-outline"}
                size={size ?? 24}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="post"
        options={{
          title: "Share",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
              <Ionicons
                name={focused ? "share-social" : "share-social-outline"}
                size={size ?? 24}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeDot} />}
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={size ?? 24}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    marginVertical: 8,
    marginHorizontal: 8,
  },
  tabPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.92,
  },
  tabFocused: {
    backgroundColor: "rgba(17, 24, 39, 0.06)",
  },

  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 28,
  },
  activeDot: {
    position: "absolute",
    top: -6,
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
});