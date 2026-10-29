/**
 * Seed Script — populates production DB with 50 realistic listings
 *
 * Users in production DB:
 *   SELLER   → aadipatel1911@gmail.com  (_id: 69dfd6545064db4990bcfc97, userType: user)
 *   BUYER    → aadi.p23@iiits.in        (_id: 69dfd6935064db4990bcfc9f, userType: recycler)
 *   DELIVERY → pateelaadii@gmail.com    (_id: 69dfd6c4e4b32b5ea7dbb985, userType: delivery)
 *
 * Distribution of 50 listings:
 *   10 → open, no bids yet
 *   10 → open, has bids from buyer (auction ongoing)
 *   5  → closed, buyer selected, payment pending (Razorpay order created, not paid)
 *   10 → closed, payment completed (transaction status: completed)
 *   15 → closed, payment completed + delivery records at various stages
 *
 * Run: node scripts/seedData.js
 */

import mongoose from "mongoose";
import crypto from "crypto";

// ─── Connection ──────────────────────────────────────────────────────────────
const MONGO_URI =
  "mongodb+srv://aadipatel1911:MyPassword123@cluster0.lp33q.mongodb.net/rebot2?retryWrites=true&w=majority&appName=Cluster0";

const SELLER_ID   = new mongoose.Types.ObjectId("69dfd6545064db4990bcfc97");
const BUYER_ID    = new mongoose.Types.ObjectId("69dfd6935064db4990bcfc9f");
const DELIVERY_ID = new mongoose.Types.ObjectId("69dfd6c4e4b32b5ea7dbb985");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const fakeRzpOrderId   = () => `order_${crypto.randomBytes(10).toString("hex")}`;
const fakeRzpPaymentId = () => `pay_${crypto.randomBytes(10).toString("hex")}`;
const fakeRzpSignature = () => crypto.randomBytes(32).toString("hex");
const fakeTracking     = () => `TRK-${Date.now()}-${randInt(1000, 9999)}`;

// ─── Product catalogue ────────────────────────────────────────────────────────
const PRODUCTS = [
  // Smartphones
  { category: "Smartphone", brand: "Apple",   model: "iPhone 13",         year: 2021, basePrice: 28000 },
  { category: "Smartphone", brand: "Apple",   model: "iPhone 12",         year: 2020, basePrice: 22000 },
  { category: "Smartphone", brand: "Apple",   model: "iPhone 11",         year: 2019, basePrice: 16000 },
  { category: "Smartphone", brand: "Samsung", model: "Galaxy S21",        year: 2021, basePrice: 24000 },
  { category: "Smartphone", brand: "Samsung", model: "Galaxy S20",        year: 2020, basePrice: 18000 },
  { category: "Smartphone", brand: "Samsung", model: "Galaxy A52",        year: 2021, basePrice: 10000 },
  { category: "Smartphone", brand: "OnePlus", model: "9 Pro",             year: 2021, basePrice: 20000 },
  { category: "Smartphone", brand: "OnePlus", model: "Nord 2",            year: 2021, basePrice: 12000 },
  { category: "Smartphone", brand: "Google",  model: "Pixel 6",           year: 2021, basePrice: 18000 },
  { category: "Smartphone", brand: "Xiaomi",  model: "Mi 11",             year: 2021, basePrice: 14000 },
  // Laptops
  { category: "Laptop",     brand: "Apple",   model: "MacBook Pro 14\"",  year: 2021, basePrice: 75000 },
  { category: "Laptop",     brand: "Apple",   model: "MacBook Air M1",    year: 2020, basePrice: 55000 },
  { category: "Laptop",     brand: "Dell",    model: "XPS 15",            year: 2021, basePrice: 60000 },
  { category: "Laptop",     brand: "Dell",    model: "Inspiron 15",       year: 2020, basePrice: 32000 },
  { category: "Laptop",     brand: "HP",      model: "Spectre x360",      year: 2021, basePrice: 58000 },
  { category: "Laptop",     brand: "Lenovo",  model: "ThinkPad X1 Carbon",year: 2021, basePrice: 62000 },
  { category: "Laptop",     brand: "ASUS",    model: "ROG Zephyrus G14",  year: 2021, basePrice: 68000 },
  { category: "Laptop",     brand: "Lenovo",  model: "IdeaPad Gaming 3",  year: 2021, basePrice: 38000 },
  // Tablets
  { category: "Tablet",     brand: "Apple",   model: "iPad Pro 11\"",     year: 2021, basePrice: 42000 },
  { category: "Tablet",     brand: "Samsung", model: "Galaxy Tab S7",     year: 2021, basePrice: 32000 },
  { category: "Tablet",     brand: "Lenovo",  model: "Tab P11 Pro",       year: 2021, basePrice: 18000 },
  // TVs
  { category: "Television", brand: "Samsung", model: "55\" 4K QLED",      year: 2020, basePrice: 35000 },
  { category: "Television", brand: "LG",      model: "55\" OLED C1",      year: 2021, basePrice: 48000 },
  { category: "Television", brand: "Sony",    model: "55\" Bravia XR",    year: 2021, basePrice: 40000 },
  { category: "Television", brand: "TCL",     model: "50\" 4K HDR",       year: 2020, basePrice: 20000 },
  // Cameras
  { category: "Camera",     brand: "Canon",   model: "EOS 90D",           year: 2019, basePrice: 45000 },
  { category: "Camera",     brand: "Nikon",   model: "D3500",             year: 2018, basePrice: 22000 },
  { category: "Camera",     brand: "Sony",    model: "Alpha A6400",       year: 2019, basePrice: 38000 },
  // Gaming
  { category: "Gaming Console", brand: "Sony",      model: "PlayStation 4 Pro", year: 2019, basePrice: 18000 },
  { category: "Gaming Console", brand: "Microsoft", model: "Xbox One X",        year: 2018, basePrice: 14000 },
  { category: "Gaming Console", brand: "Nintendo",  model: "Switch",            year: 2019, basePrice: 16000 },
  // Other
  { category: "Printer",    brand: "HP",      model: "LaserJet Pro M404",  year: 2020, basePrice: 12000 },
  { category: "Printer",    brand: "Canon",   model: "PIXMA G6020",        year: 2019, basePrice: 8000  },
  { category: "Smartwatch", brand: "Apple",   model: "Watch Series 6",     year: 2020, basePrice: 18000 },
  { category: "Smartwatch", brand: "Samsung", model: "Galaxy Watch 4",     year: 2021, basePrice: 12000 },
  { category: "Router",     brand: "TP-Link", model: "Archer AX6000",      year: 2020, basePrice: 8000  },
  { category: "Air Purifier", brand: "Dyson",  model: "Pure Cool TP07",    year: 2021, basePrice: 22000 },
  { category: "Laptop",     brand: "HP",      model: "EliteBook 840 G7",   year: 2020, basePrice: 45000 },
  { category: "Smartphone", brand: "Xiaomi",  model: "Redmi Note 10 Pro",  year: 2021, basePrice: 9000  },
  { category: "Tablet",     brand: "Apple",   model: "iPad Air 4",         year: 2020, basePrice: 36000 },
  { category: "Smartphone", brand: "Realme",  model: "GT Master Edition",  year: 2021, basePrice: 11000 },
  { category: "Camera",     brand: "GoPro",   model: "Hero 9 Black",       year: 2020, basePrice: 20000 },
  { category: "Laptop",     brand: "Microsoft",model: "Surface Pro 7",     year: 2020, basePrice: 52000 },
  { category: "Television", brand: "Mi",      model: "55\" QLED",          year: 2021, basePrice: 28000 },
  { category: "Smartphone", brand: "Vivo",    model: "X60 Pro",            year: 2021, basePrice: 13000 },
  { category: "Laptop",     brand: "Acer",    model: "Predator Helios 300", year: 2021, basePrice: 58000 },
  { category: "Smartwatch", brand: "Garmin",  model: "Fenix 6 Pro",        year: 2020, basePrice: 32000 },
  { category: "Printer",    brand: "Epson",   model: "EcoTank L3150",      year: 2020, basePrice: 6000  },
  { category: "Smartphone", brand: "Oppo",    model: "Find X3 Pro",        year: 2021, basePrice: 15000 },
  { category: "Camera",     brand: "Fujifilm", model: "X-T4",              year: 2020, basePrice: 35000 },
  { category: "Laptop",     brand: "Lenovo",   model: "Legion 5 Pro",      year: 2021, basePrice: 62000 },
];

const CONDITIONS  = ["Excellent", "Good", "Fair", "Poor"];
const LOCATIONS   = ["Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Pune", "Chennai", "Ahmedabad", "Kolkata"];
const ACCESSORIES = ["Original box included", "Charger included", "No accessories", "Case and charger", "All original accessories"];
const BATTERIES   = ["Above 90%", "80-90%", "70-80%", "Below 70%", "N/A"];
const DELIVERY_OPT= ["Home Delivery", "Pickup Only", "Both"];
const PRICE_TYPE  = ["Fixed", "Negotiable"];
const CONTACT_PREF= ["Email", "Phone", "Both"];

function makeDescription(p) {
  const cond = rand(CONDITIONS).toLowerCase();
  return `Used ${p.brand} ${p.model} (${p.year}) in ${cond} condition. Works perfectly. Minor wear and tear. Selling because upgrading to a newer model. All e-waste will be handled responsibly.`;
}

function bidAmount(basePrice) {
  // Bids are at least 50% of listing price, randomised upward
  const min = Math.ceil(basePrice * 0.5);
  return randInt(min, Math.round(basePrice * 0.9));
}

// ─── Schema definitions (mirrors the real models exactly) ─────────────────────

const listingSchema = new mongoose.Schema({
  product_category: String, brand: String, model: String,
  manufacture_year: Number, condition: String, description: String,
  accessories: String, battery: String, video_link: String,
  price: Number, price_type: String, delivery_options: String,
  name: String, email: String, phone: String,
  contact_preference: String, location: String, address: String,
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  buyer:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  image_paths: [String],
  status: { type: String, default: "open", enum: ["open", "closed"] },
  status_update_by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  created_at: { type: Date, default: Date.now },
}, { timestamps: true });

const bidSchema = new mongoose.Schema({
  bids: [{
    amount: Number,
    bidder: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdAt: { type: Date, default: Date.now },
  }],
  buyer:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  listing:{ type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  status: { type: String, enum: ["open", "closed"], default: "open" },
  minimumBidIncrement: { type: Number, default: 1 },
  highestBid: { type: Number, default: 0 },
  closeReason: { type: String, enum: ["buyer_selected", "auction_ended", "seller_cancelled"] },
  closedAt: Date,
}, { timestamps: true });

bidSchema.pre("save", function (next) {
  if (this.bids && this.bids.length > 0)
    this.highestBid = Math.max(...this.bids.map((b) => b.amount));
  next();
});

const transactionSchema = new mongoose.Schema({
  listing: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  seller:  { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
  buyer:   { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
  amount:  { type: Number, required: true },
  transactionDate: { type: Date, default: Date.now },
  status:  { type: String, enum: ["completed", "pending", "cancelled"], default: "pending" },
  razorpayOrderId: String, razorpayPaymentId: String, razorpaySignature: String,
  receiptNumber: { type: String, unique: true },
}, { timestamps: true });

transactionSchema.pre("save", async function (next) {
  if (!this.receiptNumber || this.receiptNumber.includes("TEMP")) {
    const count = await mongoose.model("SeedTransaction").countDocuments();
    this.receiptNumber = `RBT-${Date.now()}-${String(count + 1).padStart(6, "0")}`;
  }
  next();
});

const deliverySchema = new mongoose.Schema({
  orderId:   { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  sellerId:  { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
  buyerId:   { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
  deliveryPartnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  deliveryDate: { type: Date, required: true },
  status_delivery: {
    type: String,
    enum: ["pending", "shipped", "outForDelivery", "delivered"],
    default: "pending",
  },
  trackingNumber: String,
  statusHistory: [{
    status: { type: String, enum: ["pending", "shipped", "outForDelivery", "delivered"] },
    timestamp: { type: Date, default: Date.now },
    notes: { type: String, default: "" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  }],
  deliveryNotes: { type: String, default: "" },
}, { timestamps: true });

deliverySchema.pre("save", function (next) {
  if (this.isNew) {
    this.statusHistory.push({ status: "pending", timestamp: new Date(), notes: "Delivery created" });
  }
  next();
});

// Register models (use different names to avoid collision with existing app models)
const Listing     = mongoose.model("Listing",         listingSchema);
const Bid         = mongoose.model("Bid",             bidSchema);
const SeedTxn     = mongoose.model("SeedTransaction", transactionSchema, "transactions");
const SeedDel     = mongoose.model("SeedDelivery",    deliverySchema,    "deliveries");

// ─── Build status history for delivery stages ─────────────────────────────────
function buildStatusHistory(finalStatus) {
  const stages = ["pending", "shipped", "outForDelivery", "delivered"];
  const idx = stages.indexOf(finalStatus);
  const history = [];
  for (let i = 0; i <= idx; i++) {
    history.push({
      status: stages[i],
      timestamp: daysAgo(idx - i + 1),
      notes: {
        pending:        "Delivery created, awaiting pickup",
        shipped:        "Package handed over to delivery partner",
        outForDelivery: "Package out for delivery",
        delivered:      "Package delivered successfully",
      }[stages[i]],
      updatedBy: DELIVERY_ID,
    });
  }
  return history;
}

// ─── Main seed function ───────────────────────────────────────────────────────
async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB");

  // Safety: warn if collection already has listings from this seller
  const existing = await Listing.countDocuments({ seller: SELLER_ID });
  if (existing > 0) {
    console.log(`⚠️  Found ${existing} existing listings from this seller.`);
    console.log("   Run with FORCE=true to delete them first. Proceeding to ADD new ones.\n");
    if (process.env.FORCE === "true") {
      const listingIds = await Listing.find({ seller: SELLER_ID }, "_id").lean();
      const ids = listingIds.map((l) => l._id);
      await Promise.all([
        Listing.deleteMany({ seller: SELLER_ID }),
        Bid.deleteMany({ seller: SELLER_ID }),
        SeedTxn.deleteMany({ seller: SELLER_ID }),
        SeedDel.deleteMany({ sellerId: SELLER_ID }),
      ]);
      console.log("🗑️  Cleared existing data.\n");
    }
  }

  const products = [...PRODUCTS]; // 51 items, we'll use 50
  let idx = 0;

  const stats = { open_no_bids: 0, open_with_bids: 0, pending_payment: 0, paid: 0, delivered: 0 };

  // ── BATCH 1: 10 open listings, no bids ──────────────────────────────────────
  console.log("📦 Creating 10 open listings (no bids)...");
  for (let i = 0; i < 10; i++, idx++) {
    const p = products[idx];
    await Listing.create({
      product_category: p.category, brand: p.brand, model: p.model,
      manufacture_year: p.year,
      condition: rand(CONDITIONS),
      description: makeDescription(p),
      accessories: rand(ACCESSORIES), battery: rand(BATTERIES),
      price: p.basePrice,
      price_type: rand(PRICE_TYPE),
      delivery_options: rand(DELIVERY_OPT),
      name: "Aadi Patel", email: "aadipatel1911@gmail.com", phone: "9876543210",
      contact_preference: rand(CONTACT_PREF),
      location: rand(LOCATIONS), address: `${randInt(1,999)}, ${rand(LOCATIONS)} - 400001`,
      seller: SELLER_ID,
      image_paths: [],
      status: "open",
      created_at: daysAgo(randInt(5, 30)),
    });
    stats.open_no_bids++;
  }

  // ── BATCH 2: 10 open listings, has bids from buyer ──────────────────────────
  console.log("🔨 Creating 10 open listings (with active bids)...");
  for (let i = 0; i < 10; i++, idx++) {
    const p = products[idx];
    const listing = await Listing.create({
      product_category: p.category, brand: p.brand, model: p.model,
      manufacture_year: p.year,
      condition: rand(CONDITIONS),
      description: makeDescription(p),
      accessories: rand(ACCESSORIES), battery: rand(BATTERIES),
      price: p.basePrice,
      price_type: rand(PRICE_TYPE),
      delivery_options: rand(DELIVERY_OPT),
      name: "Aadi Patel", email: "aadipatel1911@gmail.com", phone: "9876543210",
      contact_preference: rand(CONTACT_PREF),
      location: rand(LOCATIONS), address: `${randInt(1,999)}, ${rand(LOCATIONS)} - 400001`,
      seller: SELLER_ID,
      image_paths: [],
      status: "open",
      created_at: daysAgo(randInt(3, 15)),
    });

    const bid = new Bid({
      seller: SELLER_ID, listing: listing._id, status: "open",
      bids: [{
        amount: bidAmount(p.basePrice),
        bidder: BUYER_ID,
        createdAt: daysAgo(randInt(1, 5)),
      }],
    });
    await bid.save();
    stats.open_with_bids++;
  }

  // ── BATCH 3: 5 closed listings, buyer selected, payment PENDING ─────────────
  console.log("💳 Creating 5 closed listings (payment pending)...");
  for (let i = 0; i < 5; i++, idx++) {
    const p = products[idx];
    const winAmount = bidAmount(p.basePrice);
    const closedDate = daysAgo(randInt(1, 3));

    const listing = await Listing.create({
      product_category: p.category, brand: p.brand, model: p.model,
      manufacture_year: p.year,
      condition: rand(CONDITIONS),
      description: makeDescription(p),
      accessories: rand(ACCESSORIES), battery: rand(BATTERIES),
      price: p.basePrice,
      price_type: rand(PRICE_TYPE),
      delivery_options: rand(DELIVERY_OPT),
      name: "Aadi Patel", email: "aadipatel1911@gmail.com", phone: "9876543210",
      contact_preference: rand(CONTACT_PREF),
      location: rand(LOCATIONS), address: `${randInt(1,999)}, ${rand(LOCATIONS)} - 400001`,
      seller: SELLER_ID, buyer: BUYER_ID, status: "closed",
      status_update_by: SELLER_ID,
      image_paths: [],
      created_at: daysAgo(randInt(5, 20)),
    });

    const bid = new Bid({
      seller: SELLER_ID, listing: listing._id,
      buyer: BUYER_ID, status: "closed",
      closeReason: "buyer_selected", closedAt: closedDate,
      bids: [{ amount: winAmount, bidder: BUYER_ID, createdAt: daysAgo(randInt(3, 10)) }],
    });
    await bid.save();

    const txn = new SeedTxn({
      listing: listing._id, seller: SELLER_ID, buyer: BUYER_ID,
      amount: winAmount, status: "pending",
      razorpayOrderId: fakeRzpOrderId(),
      transactionDate: closedDate,
    });
    await txn.save();
    stats.pending_payment++;
  }

  // ── BATCH 4: 10 closed listings, payment COMPLETED, no delivery yet ─────────
  console.log("✅ Creating 10 closed listings (payment completed)...");
  for (let i = 0; i < 10; i++, idx++) {
    const p = products[idx];
    const winAmount = bidAmount(p.basePrice);
    const closedDate = daysAgo(randInt(4, 15));

    const listing = await Listing.create({
      product_category: p.category, brand: p.brand, model: p.model,
      manufacture_year: p.year,
      condition: rand(CONDITIONS),
      description: makeDescription(p),
      accessories: rand(ACCESSORIES), battery: rand(BATTERIES),
      price: p.basePrice,
      price_type: rand(PRICE_TYPE),
      delivery_options: rand(DELIVERY_OPT),
      name: "Aadi Patel", email: "aadipatel1911@gmail.com", phone: "9876543210",
      contact_preference: rand(CONTACT_PREF),
      location: rand(LOCATIONS), address: `${randInt(1,999)}, ${rand(LOCATIONS)} - 400001`,
      seller: SELLER_ID, buyer: BUYER_ID, status: "closed",
      status_update_by: SELLER_ID,
      image_paths: [],
      created_at: daysAgo(randInt(10, 30)),
    });

    const bid = new Bid({
      seller: SELLER_ID, listing: listing._id,
      buyer: BUYER_ID, status: "closed",
      closeReason: "buyer_selected", closedAt: closedDate,
      bids: [{ amount: winAmount, bidder: BUYER_ID, createdAt: daysAgo(randInt(5, 15)) }],
    });
    await bid.save();

    const txn = new SeedTxn({
      listing: listing._id, seller: SELLER_ID, buyer: BUYER_ID,
      amount: winAmount, status: "completed",
      razorpayOrderId: fakeRzpOrderId(),
      razorpayPaymentId: fakeRzpPaymentId(),
      razorpaySignature: fakeRzpSignature(),
      transactionDate: closedDate,
    });
    await txn.save();
    stats.paid++;
  }

  // ── BATCH 5: 15 closed listings, payment COMPLETED + delivery records ────────
  console.log("🚚 Creating 15 closed listings (with delivery records)...");
  const DELIVERY_STAGES = [
    "pending",        // 4 listings
    "pending",
    "pending",
    "pending",
    "shipped",        // 4 listings
    "shipped",
    "shipped",
    "shipped",
    "outForDelivery", // 3 listings
    "outForDelivery",
    "outForDelivery",
    "delivered",      // 4 listings
    "delivered",
    "delivered",
    "delivered",
  ];

  for (let i = 0; i < 15; i++, idx++) {
    const p = products[idx];
    const winAmount = bidAmount(p.basePrice);
    const closedDate = daysAgo(randInt(7, 25));
    const deliveryStage = DELIVERY_STAGES[i];

    const listing = await Listing.create({
      product_category: p.category, brand: p.brand, model: p.model,
      manufacture_year: p.year,
      condition: rand(CONDITIONS),
      description: makeDescription(p),
      accessories: rand(ACCESSORIES), battery: rand(BATTERIES),
      price: p.basePrice,
      price_type: rand(PRICE_TYPE),
      delivery_options: rand(DELIVERY_OPT),
      name: "Aadi Patel", email: "aadipatel1911@gmail.com", phone: "9876543210",
      contact_preference: rand(CONTACT_PREF),
      location: rand(LOCATIONS), address: `${randInt(1,999)}, ${rand(LOCATIONS)} - 400001`,
      seller: SELLER_ID, buyer: BUYER_ID, status: "closed",
      status_update_by: SELLER_ID,
      image_paths: [],
      created_at: daysAgo(randInt(15, 45)),
    });

    const bid = new Bid({
      seller: SELLER_ID, listing: listing._id,
      buyer: BUYER_ID, status: "closed",
      closeReason: "buyer_selected", closedAt: closedDate,
      bids: [{ amount: winAmount, bidder: BUYER_ID, createdAt: daysAgo(randInt(8, 20)) }],
    });
    await bid.save();

    const txn = new SeedTxn({
      listing: listing._id, seller: SELLER_ID, buyer: BUYER_ID,
      amount: winAmount, status: "completed",
      razorpayOrderId: fakeRzpOrderId(),
      razorpayPaymentId: fakeRzpPaymentId(),
      razorpaySignature: fakeRzpSignature(),
      transactionDate: closedDate,
    });
    await txn.save();

    const deliveryDate = new Date(closedDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    const delivery = new SeedDel({
      orderId: listing._id,
      sellerId: SELLER_ID,
      buyerId: BUYER_ID,
      deliveryPartnerId: DELIVERY_ID,
      deliveryDate,
      status_delivery: deliveryStage,
      trackingNumber: fakeTracking(),
      statusHistory: buildStatusHistory(deliveryStage),
    });
    // Pre-save hook adds "pending" again — override with built history
    delivery.statusHistory = buildStatusHistory(deliveryStage);
    await SeedDel.collection.insertOne({
      orderId: listing._id,
      sellerId: SELLER_ID,
      buyerId: BUYER_ID,
      deliveryPartnerId: DELIVERY_ID,
      deliveryDate,
      status_delivery: deliveryStage,
      trackingNumber: fakeTracking(),
      statusHistory: buildStatusHistory(deliveryStage),
      deliveryNotes: "",
      createdAt: closedDate,
      updatedAt: new Date(),
    });
    stats.delivered++;
  }

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n🎉 Seed complete!\n");
  console.log("┌──────────────────────────────────────────┬────────┐");
  console.log("│ Category                                 │ Count  │");
  console.log("├──────────────────────────────────────────┼────────┤");
  console.log(`│ Open listings — no bids                  │  ${String(stats.open_no_bids).padStart(4)}  │`);
  console.log(`│ Open listings — with active bids         │  ${String(stats.open_with_bids).padStart(4)}  │`);
  console.log(`│ Closed — buyer selected, payment pending │  ${String(stats.pending_payment).padStart(4)}  │`);
  console.log(`│ Closed — payment completed               │  ${String(stats.paid).padStart(4)}  │`);
  console.log(`│ Closed — payment + delivery records      │  ${String(stats.delivered).padStart(4)}  │`);
  console.log("├──────────────────────────────────────────┼────────┤");
  console.log(`│ TOTAL listings                           │  ${String(stats.open_no_bids + stats.open_with_bids + stats.pending_payment + stats.paid + stats.delivered).padStart(4)}  │`);
  console.log("└──────────────────────────────────────────┴────────┘");

  console.log("\nDelivery stage breakdown (15 listings):");
  console.log("  pending        → 4");
  console.log("  shipped        → 4");
  console.log("  outForDelivery → 3");
  console.log("  delivered      → 4");

  await mongoose.disconnect();
  console.log("\n✅ Disconnected from MongoDB");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
