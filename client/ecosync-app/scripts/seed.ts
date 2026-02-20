import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
const envPath = path.join(__dirname, "../../.env");
const envLocalPath = path.join(__dirname, "../.env.local");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
}

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "https://fnnhciiooxgvffbdbwxr.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseServiceKey) {
  console.error("❌ Error: SUPABASE_SERVICE_ROLE_KEY is required for seeding.");
  console.error(
    "Please add SUPABASE_SERVICE_ROLE_KEY to your .env or .env.local file.",
  );
  console.error(
    "\nYou can find your service role key in your Supabase dashboard:",
  );
  console.error("Settings > API > service_role key (secret)");
  process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// First names and last names for generating random users
const firstNames = [
  "Alice",
  "Bob",
  "Charlie",
  "Diana",
  "Ethan",
  "Fiona",
  "George",
  "Hannah",
  "Isaac",
  "Julia",
  "Kevin",
  "Luna",
  "Marcus",
  "Nora",
  "Oscar",
  "Penelope",
  "Quinn",
  "Rachel",
  "Sam",
  "Tina",
  "Uma",
  "Victor",
  "Wendy",
  "Xavier",
  "Yara",
  "Zoe",
  "Alex",
  "Blake",
  "Casey",
  "Drew",
];

const lastNames = [
  "Johnson",
  "Smith",
  "Brown",
  "Prince",
  "Hunt",
  "Apple",
  "Lucas",
  "Montana",
  "Newton",
  "Roberts",
  "Williams",
  "Davis",
  "Miller",
  "Wilson",
  "Moore",
  "Taylor",
  "Anderson",
  "Thomas",
  "Jackson",
  "White",
  "Harris",
  "Martin",
  "Thompson",
  "Garcia",
  "Martinez",
  "Robinson",
  "Clark",
  "Rodriguez",
  "Lewis",
  "Lee",
];

// Generate unique user data based on timestamp
function generateFakeUsers(count: number = 10) {
  const timestamp = Date.now();
  const users = [];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    // Use shorter unique ID: last 4 digits of timestamp + random 4 chars (max 8 chars)
    const shortId = `${timestamp.toString().slice(-4)}${Math.random().toString(36).substring(2, 6)}`;
    // Limit username to reasonable length (first 8 chars of first+last + 8 char ID = max 16 chars)
    const namePart = `${firstName.toLowerCase().slice(0, 4)}${lastName.toLowerCase().slice(0, 4)}`;
    const username = `${namePart}${shortId}`;
    const email = `${username}@example.com`;

    users.push({
      name: `${firstName} ${lastName}`,
      username: username,
      email: email,
      password: "password123",
    });
  }

  return users;
}

// Generate unique placeholder image URLs
function generatePlaceholderImages(count: number = 10) {
  const timestamp = Date.now();
  return Array.from(
    { length: count },
    (_, i) => `https://picsum.photos/400/400?random=${timestamp}-${i}`,
  );
}

async function seed() {
  console.log("🌱 Starting seed...\n");

  try {
    // Generate unique user data for this run
    const fakeUsers = generateFakeUsers(10);
    const placeholderImages = generatePlaceholderImages(10);

    // Create users and profiles
    const createdUsers = [];

    for (let i = 0; i < fakeUsers.length; i++) {
      const fakeUser = fakeUsers[i];
      console.log(
        `Creating user ${i + 1}/10: ${fakeUser.name} (${fakeUser.username})...`,
      );

      try {
        // Check if user already exists
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const userExists = existingUser?.users?.some(
          (u) => u.email === fakeUser.email,
        );

        let userId: string;

        if (userExists) {
          console.log(`  ⚠️  User already exists, skipping auth creation...`);
          const user = existingUser.users.find(
            (u) => u.email === fakeUser.email,
          );
          if (!user) {
            console.error(`  ❌ Could not find existing user`);
            continue;
          }
          userId = user.id;
        } else {
          // Create auth user using admin API
          const { data: authData, error: authError } =
            await supabase.auth.admin.createUser({
              email: fakeUser.email,
              password: fakeUser.password,
              email_confirm: true,
            });

          if (authError) {
            // Wait a bit and check if user was created despite the error
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const { data: checkUser } = await supabase.auth.admin.listUsers();
            const maybeCreated = checkUser?.users?.find(
              (u) => u.email === fakeUser.email,
            );

            if (maybeCreated) {
              console.log(
                `  ⚠️  User was created despite error, continuing...`,
              );
              userId = maybeCreated.id;
            } else {
              console.error(
                `  ❌ Error creating auth user: ${authError.message}`,
              );
              console.error(`  Status: ${authError.status}`);
              console.error(
                `\n  💡 This error is likely caused by a database trigger that fails when creating a profile.`,
              );
              console.error(
                `  💡 The trigger probably tries to INSERT into profiles with a NULL username.`,
              );
              console.error(
                `  💡 Solution: Modify your database trigger to handle NULL usernames or provide a default value.\n`,
              );
              continue;
            }
          } else {
            if (!authData.user) {
              console.error(`  ❌ No user data returned`);
              continue;
            }
            userId = authData.user.id;
            console.log(`  ✅ Auth user created`);
          }

          // Immediately create/update profile with username
          // This must happen quickly to satisfy any trigger constraints
          const { error: profileError } = await supabase
            .from("profiles")
            .upsert(
              {
                id: userId,
                name: fakeUser.name,
                username: fakeUser.username,
                profile_image_url: placeholderImages[i],
                onboarding_completed: true,
              },
              {
                onConflict: "id",
              },
            );

          if (profileError) {
            console.error(
              `  ⚠️  Error upserting profile: ${profileError.message}`,
            );
          } else {
            console.log(`  ✅ Profile created/updated`);
          }
        }

        // Check if user already has an active post
        const { data: existingPost } = await supabase
          .from("posts")
          .select("id")
          .eq("user_id", userId)
          .eq("is_active", true)
          .gt("expires_at", new Date().toISOString())
          .limit(1)
          .single();

        if (existingPost) {
          console.log(`  ⚠️  User already has an active post, skipping...`);
        } else {
          // Create a post for this user
          const now = new Date();
          const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now

          const { error: postError } = await supabase.from("posts").insert({
            user_id: userId,
            image_url: placeholderImages[i],
            expires_at: expiresAt.toISOString(),
            is_active: true,
          });

          if (postError) {
            console.error(`  ❌ Error creating post: ${postError.message}`);
          } else {
            console.log(`  ✅ Post created`);
          }
        }

        createdUsers.push({
          userId,
          email: fakeUser.email,
          password: fakeUser.password,
          username: fakeUser.username,
        });

        console.log(`  ✅ User ${i + 1} complete\n`);
      } catch (error: any) {
        console.error(`  ❌ Unexpected error: ${error.message}\n`);
      }
    }

    console.log("\n✅ Seed completed!");
    console.log(
      `\nCreated ${createdUsers.length} users with profiles and posts.`,
    );
    console.log("\nTest credentials:");
    createdUsers.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.username} - Email: ${
          user.email
        }, Password: password123`,
      );
    });
  } catch (error: any) {
    console.error("\n❌ Seed failed:", error.message);
    process.exit(1);
  }
}

seed();