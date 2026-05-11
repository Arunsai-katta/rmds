// copy-all-collections.js
// Run with: node copy-all-collections.js

const { MongoClient } = require("mongodb");

const SOURCE_URI = "mongodb://localhost:27017";
const SOURCE_DB = "rmds";

const TARGET_URI ="Url to copy data"

const TARGET_DB = "rdms_emr";

async function copyDatabase() {
  const sourceClient = new MongoClient(SOURCE_URI);
  const targetClient = new MongoClient(TARGET_URI);

  try {
    await sourceClient.connect();
    await targetClient.connect();

    console.log("✅ Connected to both databases");

    const sourceDb = sourceClient.db(SOURCE_DB);
    const targetDb = targetClient.db(TARGET_DB);

    // Get all collections
    const collections = await sourceDb.listCollections().toArray();

    console.log(`📦 Found ${collections.length} collections`);

    for (const collectionInfo of collections) {
      const collectionName = collectionInfo.name;

      console.log(`\n🔄 Copying collection: ${collectionName}`);

      const sourceCollection = sourceDb.collection(collectionName);
      const targetCollection = targetDb.collection(collectionName);

      // Fetch all documents
      const documents = await sourceCollection.find({}).toArray();

      console.log(`   Found ${documents.length} documents`);

      if (documents.length > 0) {
        // Optional: Clear existing data
        await targetCollection.deleteMany({});

        // Insert documents
        await targetCollection.insertMany(documents);

        console.log(`   ✅ Inserted ${documents.length} documents`);
      } else {
        console.log(`   ⚠️ Collection is empty`);
      }
    }

    console.log("\n🎉 Database copy completed successfully");
  } catch (error) {
    console.error("❌ Error copying database:", error);
  } finally {
    await sourceClient.close();
    await targetClient.close();

    console.log("🔌 Connections closed");
  }
}

copyDatabase();