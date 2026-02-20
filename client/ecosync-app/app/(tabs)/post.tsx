import {
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { Image } from "expo-image";
import { Post, usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/context/AuthContext";
import { formatTimeAgo, formatTimeRemaining } from "@/lib/date-helper";

interface PostCardProps {
  post: Post;
  currentUserId?: string;
}

const PostCard = ({ post, currentUserId }: PostCardProps) => {
  const postUser = post.profiles;
  const isOwnPost = post.user_id === currentUserId;

  return (
    <View style={styles.postContainer}>
      {/* HEADER */}
      <View style={styles.postHeader}>
        <View style={styles.userInfo}>
          {postUser?.profile_image_url ? (
            <Image
              cachePolicy={"none"}
              source={{ uri: postUser.profile_image_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {postUser?.name?.[0]?.toUpperCase() || "U"}
              </Text>
            </View>
          )}

          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={styles.username}>
                {isOwnPost ? "You" : `@${postUser?.username}`}
              </Text>
            </View>
            <Text style={styles.timeAgo}>{formatTimeAgo(post.created_at)}</Text>
          </View>
        </View>

        
      </View>

      {/* IMAGE */}
      <View style={styles.imageWrap}>
        <Image
          cachePolicy={"none"}
          source={{ uri: post.image_url }}
          style={styles.postImage}
          contentFit="cover"
        />
      </View>

      {/* FOOTER */}
      <View style={styles.postFooter}>
        {post.description ? (
          <Text style={styles.postDescription} numberOfLines={3}>
            <Text style={styles.boldUser}>
              {isOwnPost ? "You" : postUser?.name || "User"}{" "}
            </Text>
            {post.description}
          </Text>
        ) : null}

        <Text style={styles.postMeta}>
          {isOwnPost ? "Your post" : `${postUser?.name}'s post`} • Expires{" "}
          {formatTimeRemaining(post.expires_at)}
        </Text>
      </View>
    </View>
  );
};

export default function Index() {
  const [showPreview, setShowPreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [description, setDescription] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const router = useRouter();
  const { createPost, posts, refreshPosts } = usePosts();
  const { user } = useAuth();

  // Check if user has an active post
  const userActivePost = posts.find(
    (post) =>
      post.user_id === user?.id &&
      post.is_active &&
      new Date(post.expires_at) > new Date(),
  );

  const hasActivePost = !!userActivePost;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshPosts();
    } catch (error) {
      console.error("Error refreshing posts:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "We need camera roll permissions to select a profile image.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPreviewImage(result.assets[0].uri);
      setShowPreview(true);
      setDescription("");
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "We need camera permissions to take a photo.",
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setPreviewImage(result.assets[0].uri);
      setShowPreview(true);
      setDescription("");
    }
  };

  const showImagePicker = () => {
    Alert.alert("Select Profile Image", "Choose an option", [
      { text: "Camera", onPress: takePhoto },
      { text: "Photo Library", onPress: pickImage },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handlePost = async () => {
    if (!previewImage) return;

    setIsUploading(true);
    try {
      await createPost(previewImage, description);
      setPreviewImage(null);
      setDescription("");
      setShowPreview(false);
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Error", "Failed to create post. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const renderPost = ({ item }: { item: Post }) => (
    <PostCard post={item} currentUserId={user?.id} />
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "top"]}>
      {/* LIST */}
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          posts.length === 0 ? styles.emptyContent : styles.content
        }
        ListEmptyComponent={<Text>No posts found</Text>}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      <TouchableOpacity style={styles.fab} onPress={showImagePicker}>
        <Text style={styles.fabText}>{hasActivePost ? "↻" : "+"}</Text>
      </TouchableOpacity>

      <Modal visible={showPreview} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {" "}
              {hasActivePost ? "Replace Your Post" : "Preview Your Post"}
            </Text>
            {previewImage && (
              <Image
                cachePolicy={"none"}
                source={{ uri: previewImage }}
                style={styles.previewImage}
                contentFit="cover"
              />
            )}
            <TextInput
              style={styles.descriptionInput}
              placeholder="Add a description (optional)"
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowPreview(false);
                  setPreviewImage(null);
                  setDescription("");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.postButton]}
                onPress={handlePost}
                disabled={isUploading}
              >
                {isUploading ? (
                  <ActivityIndicator size={24} color="#fff" />
                ) : (
                  <Text style={styles.postButtonText}>
                    {hasActivePost ? "Replace" : "Post"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAFAFA",
  },

  content: {
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 110,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  // FAB stays, but make it feel nicer
  fab: {
    position: "absolute",
    bottom: 104,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  fabText: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "400",
    lineHeight: 30,
  },

  // CARD: IG is more border + subtle shadow, not chunky
  postContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#ECECEC",

    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },

  // HEADER
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },

  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F2F2F2",
  },
  avatarPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#666",
  },

  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  username: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
  },
  timeAgo: {
    marginTop: 2,
    fontSize: 12,
    color: "#8A8A8A",
    fontWeight: "500",
  },

  // EXPIRATION: subtle pill
  expiryPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E7E7EA",
  },
  expiryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#222",
  },

  // IMAGE: give it a clean frame
  imageWrap: {
    backgroundColor: "#F4F4F5",
  },
  postImage: {
    width: "100%",
    aspectRatio: 1,
  },

  // FOOTER
  postFooter: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },

  postDescription: {
    fontSize: 14,
    color: "#111",
    lineHeight: 20,
  },
  boldUser: {
    fontWeight: "800",
  },

  postMeta: {
    marginTop: 8,
    fontSize: 12,
    color: "#8A8A8A",
    fontWeight: "600",
  },

  // MODAL (your existing is fine; I’ll just lightly refine)
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: "#ECECEC",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 14,
    textAlign: "center",
    color: "#111",
  },
  previewImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 14,
    marginBottom: 14,
    backgroundColor: "#F4F4F5",
  },
  descriptionInput: {
    width: "100%",
    minHeight: 80,
    maxHeight: 130,
    backgroundColor: "#FAFAFA",
    borderRadius: 14,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ECECEC",
    color: "#111",
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F4F4F5",
    borderWidth: 1,
    borderColor: "#E7E7EA",
  },
  cancelButtonText: {
    color: "#111",
    fontSize: 15,
    fontWeight: "800",
  },
  postButton: {
    backgroundColor: "#111",
  },
  postButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
});