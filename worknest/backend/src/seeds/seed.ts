import mongoose from "mongoose";
import dotenv from "dotenv";
import {
  Organization,
  User,
  Channel,
  ChannelMember,
  Message,
} from "../models/index.js";

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/worknest";

const seedDatabase = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    // Clear existing data
    await Organization.deleteMany({});
    await User.deleteMany({});
    await Channel.deleteMany({});
    await ChannelMember.deleteMany({});
    await Message.deleteMany({});
    console.log("🗑️ Cleared existing data");

    // Create demo organizations
    const orgs = await Organization.create([
      {
        name: "Zoho Corporation",
        subdomain: "zoho",
        status: "ACTIVE",
        plan: "ENTERPRISE",
      },
      {
        name: "Infosys Limited",
        subdomain: "infosys",
        status: "ACTIVE",
        plan: "PRO",
      },
      {
        name: "TechStart Inc",
        subdomain: "techstart",
        status: "ACTIVE",
        plan: "FREE",
      },
    ]);

    console.log(`✅ Created ${orgs.length} organizations`);

    // Create users for each organization
    for (const org of orgs) {
      // Admin user
      const admin = await User.create({
        organizationId: org._id,
        name: `Admin ${org.name.split(" ")[0]}`,
        email: `admin@${org.subdomain}.com`,
        passwordHash: "password123",
        role: "ADMIN",
        status: "ACTIVE",
      });

      // Regular users
      const users = await User.create([
        {
          organizationId: org._id,
          name: "John Developer",
          email: `john@${org.subdomain}.com`,
          passwordHash: "password123",
          role: "EMPLOYEE",
          status: "ACTIVE",
        },
        {
          organizationId: org._id,
          name: "Sarah Designer",
          email: `sarah@${org.subdomain}.com`,
          passwordHash: "password123",
          role: "EMPLOYEE",
          status: "ACTIVE",
        },
        {
          organizationId: org._id,
          name: "Mike Manager",
          email: `mike@${org.subdomain}.com`,
          passwordHash: "password123",
          role: "EMPLOYEE",
          status: "ACTIVE",
        },
      ]);

      const allUsers = [admin, ...users];
      console.log(`  ✅ Created ${allUsers.length} users for ${org.name}`);

      // Create channels
      const generalChannel = await Channel.create({
        organizationId: org._id,
        name: "general",
        description: "General discussion for everyone",
        type: "PUBLIC",
        createdBy: admin._id,
      });

      const engineeringChannel = await Channel.create({
        organizationId: org._id,
        name: "engineering",
        description: "Engineering team discussions",
        type: "PUBLIC",
        createdBy: admin._id,
      });

      const designChannel = await Channel.create({
        organizationId: org._id,
        name: "design",
        description: "Design team discussions",
        type: "PRIVATE",
        createdBy: admin._id,
      });

      const randomChannel = await Channel.create({
        organizationId: org._id,
        name: "random",
        description: "Non-work banter and fun stuff",
        type: "PUBLIC",
        createdBy: admin._id,
      });

      const channels = [
        generalChannel,
        engineeringChannel,
        designChannel,
        randomChannel,
      ];
      console.log(`  ✅ Created ${channels.length} channels for ${org.name}`);

      // Add members to channels
      for (const channel of channels) {
        for (const user of allUsers) {
          await ChannelMember.create({
            organizationId: org._id,
            channelId: channel._id,
            userId: user._id,
            role: user._id.equals(admin._id) ? "ADMIN" : "MEMBER",
          });
        }
      }

      // Create DM channel between admin and first user
      const dmChannel = await Channel.create({
        organizationId: org._id,
        name: "Direct Message",
        type: "DM",
        createdBy: admin._id,
        dmParticipants: [admin._id, users[0]._id],
      });

      await ChannelMember.create([
        {
          organizationId: org._id,
          channelId: dmChannel._id,
          userId: admin._id,
          role: "MEMBER",
        },
        {
          organizationId: org._id,
          channelId: dmChannel._id,
          userId: users[0]._id,
          role: "MEMBER",
        },
      ]);

      // Create sample messages
      const sampleMessages = [
        {
          content: "Welcome to the team! 🎉",
          sender: admin,
          channel: generalChannel,
        },
        {
          content: "Thanks! Excited to be here!",
          sender: users[0],
          channel: generalChannel,
        },
        {
          content: "Hey everyone, the new feature is ready for review",
          sender: users[0],
          channel: engineeringChannel,
        },
        {
          content: "Great work! I'll take a look at the PR",
          sender: admin,
          channel: engineeringChannel,
        },
        {
          content: "Just pushed the new design mockups",
          sender: users[1],
          channel: designChannel,
        },
        {
          content: "Anyone up for lunch today?",
          sender: users[2],
          channel: randomChannel,
        },
        {
          content: "Count me in! 🍕",
          sender: users[0],
          channel: randomChannel,
        },
      ];

      for (const msg of sampleMessages) {
        await Message.create({
          organizationId: org._id,
          channelId: msg.channel._id,
          senderId: msg.sender._id,
          content: msg.content,
          contentType: "TEXT",
        });
      }

      // System message
      await Message.create({
        organizationId: org._id,
        channelId: generalChannel._id,
        senderId: admin._id,
        content: 'Channel "general" was created',
        contentType: "SYSTEM",
      });

      console.log(`  ✅ Created sample messages for ${org.name}`);
    }

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ✅ Database seeded successfully!                            ║
║                                                               ║
║   Demo Organizations:                                         ║
║   • zoho.worknest.com (admin@zoho.com)                        ║
║   • infosys.worknest.com (admin@infosys.com)                  ║
║   • techstart.worknest.com (admin@techstart.com)              ║
║                                                               ║
║   Password for all users: password123                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed error:", error);
    process.exit(1);
  }
};

seedDatabase();
