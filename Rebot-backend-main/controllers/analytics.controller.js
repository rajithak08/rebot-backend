import User from "../models/user.model.js";
import Listing from "../models/listing.model.js";
import Bid from "../models/bid.model.js";
import Transaction from "../models/transaction.model.js";
import Delivery from "../models/delivery.model.js";
import Certificate from "../models/certificate.model.js";
import Chat from "../models/chat.model.js";
import Message from "../models/message.model.js";
import mongoose from "mongoose";

// ==================== HELPER FUNCTIONS ====================

// Parse date range from query params
const getDateRange = (timeframe, customStart, customEnd) => {
  const now = new Date();
  let startDate, endDate;

  switch (timeframe) {
    case "today":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      endDate = new Date();
      break;
    case "week":
      startDate = new Date(now.setDate(now.getDate() - 7));
      endDate = new Date();
      break;
    case "month":
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      endDate = new Date();
      break;
    case "year":
      startDate = new Date(now.setFullYear(now.getFullYear() - 1));
      endDate = new Date();
      break;
    case "custom":
      startDate = customStart ? new Date(customStart) : new Date(0);
      endDate = customEnd ? new Date(customEnd) : new Date();
      break;
    default:
      startDate = new Date(0); // Beginning of time
      endDate = new Date();
  }

  return { startDate, endDate };
};

// ==================== OVERVIEW ANALYTICS ====================

export const getOverviewAnalytics = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { timeframe = "all", customStart, customEnd } = req.query;
    const { startDate, endDate } = getDateRange(
      timeframe,
      customStart,
      customEnd,
    );

    // Platform Health Metrics
    const totalUsers = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const totalListings = await Listing.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const totalTransactions = await Transaction.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });
    const totalDeliveries = await Delivery.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Revenue Metrics
    const revenueData = await Transaction.aggregate([
      {
        $match: {
          status: "completed",
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          avgTransaction: { $avg: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const revenue = revenueData[0] || {
      totalRevenue: 0,
      avgTransaction: 0,
      count: 0,
    };

    // Active Users (logged in within last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const activeUsers = await User.countDocuments({
      lasLogin: { $gte: sevenDaysAgo },
    });

    // Growth Rates
    const previousPeriodStart = new Date(
      startDate.getTime() - (endDate.getTime() - startDate.getTime()),
    );
    const previousUsers = await User.countDocuments({
      createdAt: { $gte: previousPeriodStart, $lt: startDate },
    });
    const userGrowthRate =
      previousUsers > 0
        ? (((totalUsers - previousUsers) / previousUsers) * 100).toFixed(2)
        : 100;

    res.status(200).json({
      success: true,
      data: {
        platformHealth: {
          totalUsers,
          totalListings,
          totalTransactions,
          totalDeliveries,
          activeUsers,
          userGrowthRate: parseFloat(userGrowthRate),
        },
        revenue: {
          total: revenue.totalRevenue,
          average: revenue.avgTransaction,
          transactionCount: revenue.count,
        },
        timeframe: {
          startDate,
          endDate,
          period: timeframe,
        },
      },
    });
  } catch (error) {
    console.error("Error in getOverviewAnalytics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== USER ANALYTICS ====================

export const getUserAnalytics = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { timeframe = "all", customStart, customEnd } = req.query;
    const { startDate, endDate } = getDateRange(
      timeframe,
      customStart,
      customEnd,
    );

    // User Overview
    const totalUsers = await User.countDocuments();
    const usersInPeriod = await User.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // User Types Breakdown
    const userTypes = await User.aggregate([
      { $group: { _id: "$userType", count: { $sum: 1 } } },
    ]);

    // Email Verification Status
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    const unverifiedUsers = await User.countDocuments({
      emailVerified: false,
    });

    // Active vs Inactive Users
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await User.countDocuments({
      lasLogin: { $gte: thirtyDaysAgo },
    });
    const inactiveUsers = totalUsers - activeUsers;

    // User Registration Trends (Daily for last 30 days)
    const registrationTrends = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Weekly, Monthly, Yearly stats
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const newUsersThisWeek = await User.countDocuments({
      createdAt: { $gte: weekAgo },
    });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: monthAgo },
    });
    const newUsersThisYear = await User.countDocuments({
      createdAt: { $gte: yearAgo },
    });

    // Users with complete profiles
    const completeProfiles = await User.countDocuments({
      phone: { $ne: "" },
      addresses: { $exists: true, $ne: [] },
    });

    res.status(200).json({
      success: true,
      data: {
        overview: {
          total: totalUsers,
          inPeriod: usersInPeriod,
          newThisWeek: newUsersThisWeek,
          newThisMonth: newUsersThisMonth,
          newThisYear: newUsersThisYear,
        },
        userTypes: userTypes.reduce((acc, type) => {
          acc[type._id] = type.count;
          return acc;
        }, {}),
        verification: {
          verified: verifiedUsers,
          unverified: unverifiedUsers,
          verificationRate: (
            (verifiedUsers / (verifiedUsers + unverifiedUsers)) *
            100
          ).toFixed(2),
        },
        activity: {
          active: activeUsers,
          inactive: inactiveUsers,
          activityRate: ((activeUsers / totalUsers) * 100).toFixed(2),
        },
        profiles: {
          complete: completeProfiles,
          incomplete: totalUsers - completeProfiles,
          completionRate: ((completeProfiles / totalUsers) * 100).toFixed(2),
        },
        registrationTrends,
      },
    });
  } catch (error) {
    console.error("Error in getUserAnalytics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Get individual user deep dive analytics (role-specific)
export const getUserDeepDive = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin || admin.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { userId } = req.params;

    // Get user details
    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const oid = new mongoose.Types.ObjectId(userId);

    // ── Common stats for all user types ──

    // Chat activity
    const chats = await Chat.countDocuments({
      $or: [{ seller: userId }, { buyer: userId }],
    });
    const messages = await Message.countDocuments({ sender: userId });

    // Account age in days
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    // Monthly activity trend (messages sent per month, last 6 months)
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const monthlyActivity = await Message.aggregate([
      { $match: { sender: oid, createdAt: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // ── Build role-specific response ──

    if (user.userType === "user") {
      // ====== NORMAL USER ANALYTICS ======

      // Listings posted
      const listingsPosted = await Listing.countDocuments({ seller: userId });
      const openListings = await Listing.countDocuments({
        seller: userId,
        status: "open",
      });
      const closedListings = await Listing.countDocuments({
        seller: userId,
        status: "closed",
      });

      // Sales revenue
      const salesData = await Transaction.aggregate([
        { $match: { seller: oid, status: "completed" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalRevenue: { $sum: "$amount" },
            avgSale: { $avg: "$amount" },
          },
        },
      ]);
      const sales = salesData[0] || { count: 0, totalRevenue: 0, avgSale: 0 };

      // Listing categories breakdown
      const categoryBreakdown = await Listing.aggregate([
        { $match: { seller: oid } },
        { $group: { _id: "$product_category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      // Listing price stats
      const priceStats = await Listing.aggregate([
        { $match: { seller: oid } },
        {
          $group: {
            _id: null,
            avgPrice: { $avg: "$price" },
            minPrice: { $min: "$price" },
            maxPrice: { $max: "$price" },
            totalValue: { $sum: "$price" },
          },
        },
      ]);

      // Deliveries as seller
      const deliveriesAsSeller = await Delivery.countDocuments({
        sellerId: userId,
      });
      const completedDeliveriesAsSeller = await Delivery.countDocuments({
        sellerId: userId,
        status_delivery: "delivered",
      });

      // Bids received on their listings
      const bidsReceived = await Bid.aggregate([
        {
          $lookup: {
            from: "listings",
            localField: "listing",
            foreignField: "_id",
            as: "listingDoc",
          },
        },
        { $unwind: "$listingDoc" },
        { $match: { "listingDoc.seller": oid } },
        { $unwind: "$bids" },
        {
          $group: {
            _id: null,
            totalBidsReceived: { $sum: 1 },
            avgBidAmount: { $avg: "$bids.amount" },
            highestBid: { $max: "$bids.amount" },
          },
        },
      ]);

      // Recent listings
      const recentListings = await Listing.find({ seller: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          "product_category brand model price status createdAt image_paths",
        );

      // Recent transactions
      const recentTransactions = await Transaction.find({ seller: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("listing", "product_category brand model")
        .select("amount status transactionDate receiptNumber buyer");

      // Monthly revenue trend
      const monthlyRevenue = await Transaction.aggregate([
        {
          $match: {
            seller: oid,
            status: "completed",
            createdAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            revenue: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      return res.status(200).json({
        success: true,
        data: {
          user,
          roleType: "user",
          accountAgeDays,
          stats: {
            listings: {
              total: listingsPosted,
              open: openListings,
              closed: closedListings,
              completionRate:
                listingsPosted > 0
                  ? ((closedListings / listingsPosted) * 100).toFixed(2)
                  : 0,
            },
            sales: {
              count: sales.count,
              totalRevenue: sales.totalRevenue,
              average: sales.avgSale,
            },
            pricing: priceStats[0] || {
              avgPrice: 0,
              minPrice: 0,
              maxPrice: 0,
              totalValue: 0,
            },
            bidsReceived: bidsReceived[0] || {
              totalBidsReceived: 0,
              avgBidAmount: 0,
              highestBid: 0,
            },
            deliveries: {
              total: deliveriesAsSeller,
              completed: completedDeliveriesAsSeller,
            },
            communication: { chats, messagesSent: messages },
          },
          categoryBreakdown: categoryBreakdown.map((c) => ({
            category: c._id,
            count: c.count,
          })),
          trends: {
            monthlyRevenue,
            monthlyActivity,
          },
          recentActivity: {
            listings: recentListings,
            transactions: recentTransactions,
          },
        },
      });
    }

    if (user.userType === "recycler") {
      // ====== RECYCLER / RECYCLING PARTNER ANALYTICS ======

      // Bids placed
      const bidsData = await Bid.aggregate([
        { $unwind: "$bids" },
        { $match: { "bids.bidder": oid } },
        {
          $group: {
            _id: null,
            totalBids: { $sum: 1 },
            totalAmount: { $sum: "$bids.amount" },
            avgBid: { $avg: "$bids.amount" },
            maxBid: { $max: "$bids.amount" },
            minBid: { $min: "$bids.amount" },
          },
        },
      ]);
      const bids = bidsData[0] || {
        totalBids: 0,
        totalAmount: 0,
        avgBid: 0,
        maxBid: 0,
        minBid: 0,
      };

      // Bids won (transactions as buyer)
      const purchaseData = await Transaction.aggregate([
        { $match: { buyer: oid, status: "completed" } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalSpent: { $sum: "$amount" },
            avgPurchase: { $avg: "$amount" },
          },
        },
      ]);
      const purchases = purchaseData[0] || {
        count: 0,
        totalSpent: 0,
        avgPurchase: 0,
      };

      // Win rate
      const winRate =
        bids.totalBids > 0
          ? ((purchases.count / bids.totalBids) * 100).toFixed(2)
          : 0;

      // Categories they bid on
      const bidCategories = await Bid.aggregate([
        { $unwind: "$bids" },
        { $match: { "bids.bidder": oid } },
        {
          $lookup: {
            from: "listings",
            localField: "listing",
            foreignField: "_id",
            as: "listingDoc",
          },
        },
        { $unwind: "$listingDoc" },
        {
          $group: {
            _id: "$listingDoc.product_category",
            count: { $sum: 1 },
            avgBidAmount: { $avg: "$bids.amount" },
          },
        },
        { $sort: { count: -1 } },
      ]);

      // Certificates
      const totalCerts = await Certificate.countDocuments({ uploadby: userId });
      const approvedCerts = await Certificate.countDocuments({
        uploadby: userId,
        status: "approved",
      });
      const pendingCerts = await Certificate.countDocuments({
        uploadby: userId,
        status: "pending",
      });
      const disapprovedCerts = await Certificate.countDocuments({
        uploadby: userId,
        status: "disapproved",
      });

      // Valid vs expired certificates
      const now = new Date();
      const validCerts = await Certificate.countDocuments({
        uploadby: userId,
        status: "approved",
        "validityPeriod.end": { $gt: now },
      });
      const expiredCerts = await Certificate.countDocuments({
        uploadby: userId,
        "validityPeriod.end": { $lte: now },
      });

      // Deliveries as buyer
      const deliveriesAsBuyer = await Delivery.countDocuments({
        buyerId: userId,
      });
      const completedDeliveriesAsBuyer = await Delivery.countDocuments({
        buyerId: userId,
        status_delivery: "delivered",
      });

      // Monthly spending trend
      const monthlySpending = await Transaction.aggregate([
        {
          $match: {
            buyer: oid,
            status: "completed",
            createdAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            spent: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Monthly bids trend
      const monthlyBids = await Bid.aggregate([
        { $unwind: "$bids" },
        {
          $match: {
            "bids.bidder": oid,
            "bids.createdAt": { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$bids.createdAt" },
            },
            count: { $sum: 1 },
            totalAmount: { $sum: "$bids.amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Recent purchases
      const recentPurchases = await Transaction.find({ buyer: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("listing", "product_category brand model")
        .select("amount status transactionDate receiptNumber seller");

      // Recent certificates
      const recentCertificates = await Certificate.find({ uploadby: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select(
          "documentType issuingAuthority status validityPeriod createdAt",
        );

      return res.status(200).json({
        success: true,
        data: {
          user,
          roleType: "recycler",
          accountAgeDays,
          stats: {
            bids: {
              total: bids.totalBids,
              totalAmount: bids.totalAmount,
              average: bids.avgBid,
              highest: bids.maxBid,
              lowest: bids.minBid,
              winRate: parseFloat(winRate),
            },
            purchases: {
              count: purchases.count,
              totalSpent: purchases.totalSpent,
              average: purchases.avgPurchase,
            },
            certificates: {
              total: totalCerts,
              approved: approvedCerts,
              pending: pendingCerts,
              disapproved: disapprovedCerts,
              valid: validCerts,
              expired: expiredCerts,
            },
            deliveries: {
              total: deliveriesAsBuyer,
              completed: completedDeliveriesAsBuyer,
            },
            communication: { chats, messagesSent: messages },
          },
          bidCategories: bidCategories.map((c) => ({
            category: c._id,
            count: c.count,
            avgBidAmount: c.avgBidAmount,
          })),
          trends: {
            monthlySpending,
            monthlyBids,
            monthlyActivity,
          },
          recentActivity: {
            purchases: recentPurchases,
            certificates: recentCertificates,
          },
        },
      });
    }

    if (user.userType === "delivery") {
      // ====== DELIVERY PARTNER ANALYTICS ======

      // Deliveries assigned
      const totalDeliveries = await Delivery.countDocuments({
        deliveryPartnerId: userId,
      });
      const completedDeliveries = await Delivery.countDocuments({
        deliveryPartnerId: userId,
        status_delivery: "delivered",
      });
      const pendingDeliveries = await Delivery.countDocuments({
        deliveryPartnerId: userId,
        status_delivery: "pending",
      });
      const shippedDeliveries = await Delivery.countDocuments({
        deliveryPartnerId: userId,
        status_delivery: "shipped",
      });
      const outForDeliveryCount = await Delivery.countDocuments({
        deliveryPartnerId: userId,
        status_delivery: "outForDelivery",
      });

      // Completion rate
      const completionRate =
        totalDeliveries > 0
          ? ((completedDeliveries / totalDeliveries) * 100).toFixed(2)
          : 0;

      // Average delivery time (for completed deliveries)
      const deliveryTimeStats = await Delivery.aggregate([
        {
          $match: {
            deliveryPartnerId: oid,
            status_delivery: "delivered",
            deliveryDate: { $exists: true },
          },
        },
        {
          $project: {
            deliveryTime: {
              $divide: [
                { $subtract: ["$deliveryDate", "$createdAt"] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            avgDeliveryDays: { $avg: "$deliveryTime" },
            minDeliveryDays: { $min: "$deliveryTime" },
            maxDeliveryDays: { $max: "$deliveryTime" },
          },
        },
      ]);

      // Delivery status breakdown
      const statusBreakdown = await Delivery.aggregate([
        { $match: { deliveryPartnerId: oid } },
        { $group: { _id: "$status_delivery", count: { $sum: 1 } } },
      ]);

      // Monthly delivery trends
      const monthlyDeliveries = await Delivery.aggregate([
        {
          $match: { deliveryPartnerId: oid, createdAt: { $gte: sixMonthsAgo } },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            total: { $sum: 1 },
            completed: {
              $sum: {
                $cond: [{ $eq: ["$status_delivery", "delivered"] }, 1, 0],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Delivery by day of week (performance pattern)
      const deliveryByDay = await Delivery.aggregate([
        { $match: { deliveryPartnerId: oid } },
        {
          $project: {
            day: { $dayOfWeek: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$day",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const deliveryByDayMapped = deliveryByDay.map((d) => ({
        day: dayNames[d._id - 1],
        count: d.count,
      }));

      // Recent deliveries
      const recentDeliveries = await Delivery.find({
        deliveryPartnerId: userId,
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("orderId", "product_category brand model")
        .populate("sellerId", "name")
        .populate("buyerId", "name")
        .select("status_delivery deliveryDate trackingNumber createdAt");

      return res.status(200).json({
        success: true,
        data: {
          user,
          roleType: "delivery",
          accountAgeDays,
          stats: {
            deliveries: {
              total: totalDeliveries,
              completed: completedDeliveries,
              pending: pendingDeliveries,
              shipped: shippedDeliveries,
              outForDelivery: outForDeliveryCount,
              completionRate: parseFloat(completionRate),
            },
            performance: {
              avgDeliveryDays: deliveryTimeStats[0]?.avgDeliveryDays || 0,
              minDeliveryDays: deliveryTimeStats[0]?.minDeliveryDays || 0,
              maxDeliveryDays: deliveryTimeStats[0]?.maxDeliveryDays || 0,
            },
            communication: { chats, messagesSent: messages },
          },
          statusBreakdown: statusBreakdown.map((s) => ({
            status: s._id,
            count: s.count,
          })),
          deliveryByDay: deliveryByDayMapped,
          trends: {
            monthlyDeliveries,
            monthlyActivity,
          },
          recentActivity: {
            deliveries: recentDeliveries,
          },
        },
      });
    }

    // ====== FALLBACK (admin or unknown type) ======
    return res.status(200).json({
      success: true,
      data: {
        user,
        roleType: user.userType,
        accountAgeDays,
        stats: {
          communication: { chats, messagesSent: messages },
        },
        trends: { monthlyActivity },
      },
    });
  } catch (error) {
    console.error("Error in getUserDeepDive:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== LISTING ANALYTICS ====================

export const getListingAnalytics = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { timeframe = "all", customStart, customEnd } = req.query;
    const { startDate, endDate } = getDateRange(
      timeframe,
      customStart,
      customEnd,
    );

    // Overview
    const totalListings = await Listing.countDocuments();
    const openListings = await Listing.countDocuments({ status: "open" });
    const closedListings = await Listing.countDocuments({ status: "closed" });
    const listingsInPeriod = await Listing.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Listings by category
    const byCategory = await Listing.aggregate([
      { $group: { _id: "$product_category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Listings by status
    const byStatus = await Listing.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Listings by condition
    const byCondition = await Listing.aggregate([
      { $group: { _id: "$condition", count: { $sum: 1 } } },
    ]);

    // Price distribution
    const priceStats = await Listing.aggregate([
      {
        $group: {
          _id: null,
          avgPrice: { $avg: "$price" },
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
          totalValue: { $sum: "$price" },
        },
      },
    ]);

    // Top brands
    const topBrands = await Listing.aggregate([
      { $match: { brand: { $exists: true, $ne: "" } } },
      { $group: { _id: "$brand", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Top models
    const topModels = await Listing.aggregate([
      { $match: { model: { $exists: true, $ne: "" } } },
      { $group: { _id: "$model", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Listings with images
    const withImages = await Listing.countDocuments({
      image_paths: { $exists: true, $ne: [] },
    });
    const withoutImages = await Listing.countDocuments({
      $or: [{ image_paths: { $exists: false } }, { image_paths: { $size: 0 } }],
    });

    // Listings with video
    const withVideo = await Listing.countDocuments({
      video_link: { $exists: true, $ne: "" },
    });

    // Average images per listing
    const imageStats = await Listing.aggregate([
      { $match: { image_paths: { $exists: true } } },
      {
        $project: {
          imageCount: { $size: { $ifNull: ["$image_paths", []] } },
        },
      },
      {
        $group: {
          _id: null,
          avgImages: { $avg: "$imageCount" },
        },
      },
    ]);

    // Location distribution
    const byLocation = await Listing.aggregate([
      { $match: { location: { $exists: true, $ne: "" } } },
      { $group: { _id: "$location", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Average time to close (for closed listings)
    const closedListingsWithTime = await Listing.aggregate([
      { $match: { status: "closed", updatedAt: { $exists: true } } },
      {
        $project: {
          timeToClose: {
            $divide: [
              { $subtract: ["$updatedAt", "$createdAt"] },
              1000 * 60 * 60 * 24, // Convert to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDaysToClose: { $avg: "$timeToClose" },
        },
      },
    ]);

    // Listing creation trends (last 30 days)
    const creationTrends = await Listing.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Conversion rate
    const conversionRate =
      totalListings > 0
        ? ((closedListings / totalListings) * 100).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          total: totalListings,
          open: openListings,
          closed: closedListings,
          inPeriod: listingsInPeriod,
          conversionRate: parseFloat(conversionRate),
          avgTimeToClose: closedListingsWithTime[0]?.avgDaysToClose || 0,
        },
        distribution: {
          byCategory: byCategory.map((c) => ({
            category: c._id,
            count: c.count,
          })),
          byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
          byCondition: byCondition.map((c) => ({
            condition: c._id,
            count: c.count,
          })),
          byLocation: byLocation.map((l) => ({
            location: l._id,
            count: l.count,
          })),
        },
        pricing: {
          average: priceStats[0]?.avgPrice || 0,
          min: priceStats[0]?.minPrice || 0,
          max: priceStats[0]?.maxPrice || 0,
          totalValue: priceStats[0]?.totalValue || 0,
        },
        brands: {
          top: topBrands.map((b) => ({ brand: b._id, count: b.count })),
        },
        models: {
          top: topModels.map((m) => ({ model: m._id, count: m.count })),
        },
        quality: {
          withImages,
          withoutImages,
          withVideo,
          avgImagesPerListing: imageStats[0]?.avgImages || 0,
        },
        trends: {
          creation: creationTrends,
        },
      },
    });
  } catch (error) {
    console.error("Error in getListingAnalytics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== BID ANALYTICS ====================

export const getBidAnalytics = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { timeframe = "all", customStart, customEnd } = req.query;
    const { startDate, endDate } = getDateRange(
      timeframe,
      customStart,
      customEnd,
    );

    // Total bids
    const totalBidDocs = await Bid.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Unwind bids to count individual bids
    const bidStats = await Bid.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $unwind: "$bids" },
      {
        $group: {
          _id: null,
          totalBids: { $sum: 1 },
          totalVolume: { $sum: "$bids.amount" },
          avgBidAmount: { $avg: "$bids.amount" },
        },
      },
    ]);

    const stats = bidStats[0] || {
      totalBids: 0,
      totalVolume: 0,
      avgBidAmount: 0,
    };

    // Active auctions
    const activeAuctions = await Bid.countDocuments({ status: "open" });
    const closedAuctions = await Bid.countDocuments({ status: "closed" });

    // Average bids per listing
    const bidsPerListing = await Bid.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $project: {
          bidCount: { $size: "$bids" },
        },
      },
      {
        $group: {
          _id: null,
          avgBidsPerListing: { $avg: "$bidCount" },
        },
      },
    ]);

    // Successful bids (with buyer selected)
    const successfulBids = await Bid.countDocuments({
      buyer: { $exists: true, $ne: null },
      status: "closed",
    });

    // Bid success rate
    const bidSuccessRate =
      totalBidDocs > 0 ? ((successfulBids / totalBidDocs) * 100).toFixed(2) : 0;

    // Top bidders
    const topBidders = await Bid.aggregate([
      { $unwind: "$bids" },
      {
        $group: {
          _id: "$bids.bidder",
          totalBids: { $sum: 1 },
          totalAmount: { $sum: "$bids.amount" },
        },
      },
      { $sort: { totalBids: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          name: "$user.name",
          email: "$user.email",
          totalBids: 1,
          totalAmount: 1,
        },
      },
    ]);

    // Bidding activity by hour
    const biddingByHour = await Bid.aggregate([
      { $unwind: "$bids" },
      {
        $project: {
          hour: { $hour: "$bids.createdAt" },
        },
      },
      {
        $group: {
          _id: "$hour",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Most competitive listings (most bids)
    const mostCompetitive = await Bid.aggregate([
      {
        $project: {
          listing: 1,
          bidCount: { $size: "$bids" },
          highestBid: 1,
        },
      },
      { $sort: { bidCount: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "listings",
          localField: "listing",
          foreignField: "_id",
          as: "listingDetails",
        },
      },
      { $unwind: "$listingDetails" },
      {
        $project: {
          listingId: "$listing",
          product: "$listingDetails.product_category",
          brand: "$listingDetails.brand",
          model: "$listingDetails.model",
          bidCount: 1,
          highestBid: 1,
        },
      },
    ]);

    // Bid vs listing price ratio
    const bidPriceRatio = await Bid.aggregate([
      {
        $lookup: {
          from: "listings",
          localField: "listing",
          foreignField: "_id",
          as: "listingDetails",
        },
      },
      { $unwind: "$listingDetails" },
      {
        $project: {
          ratio: {
            $multiply: [
              { $divide: ["$highestBid", "$listingDetails.price"] },
              100,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgRatio: { $avg: "$ratio" },
        },
      },
    ]);

    // Recycler vs regular user bidding
    const bidderTypes = await Bid.aggregate([
      { $unwind: "$bids" },
      {
        $lookup: {
          from: "users",
          localField: "bids.bidder",
          foreignField: "_id",
          as: "bidder",
        },
      },
      { $unwind: "$bidder" },
      {
        $group: {
          _id: "$bidder.userType",
          count: { $sum: 1 },
          totalAmount: { $sum: "$bids.amount" },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalBids: stats.totalBids,
          totalVolume: stats.totalVolume,
          averageBidAmount: stats.avgBidAmount,
          activeAuctions,
          closedAuctions,
          averageBidsPerListing: bidsPerListing[0]?.avgBidsPerListing || 0,
          successfulBids,
          successRate: parseFloat(bidSuccessRate),
        },
        topBidders,
        competition: {
          mostCompetitiveListings: mostCompetitive,
        },
        patterns: {
          biddingByHour: biddingByHour.map((h) => ({
            hour: h._id,
            count: h.count,
          })),
          bidPriceRatio: bidPriceRatio[0]?.avgRatio || 0,
        },
        bidderTypes: bidderTypes.map((bt) => ({
          userType: bt._id,
          count: bt.count,
          totalAmount: bt.totalAmount,
        })),
      },
    });
  } catch (error) {
    console.error("Error in getBidAnalytics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== TRANSACTION ANALYTICS ====================

export const getTransactionAnalytics = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { timeframe = "all", customStart, customEnd } = req.query;
    const { startDate, endDate } = getDateRange(
      timeframe,
      customStart,
      customEnd,
    );

    // Overview
    const totalTransactions = await Transaction.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const transactionStats = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "completed",
        },
      },
      {
        $group: {
          _id: null,
          totalValue: { $sum: "$amount" },
          avgValue: { $avg: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const stats = transactionStats[0] || {
      totalValue: 0,
      avgValue: 0,
      count: 0,
    };

    // Transaction by status
    const byStatus = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    // Revenue by category
    const revenueByCategory = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "completed",
        },
      },
      {
        $lookup: {
          from: "listings",
          localField: "listing",
          foreignField: "_id",
          as: "listing",
        },
      },
      { $unwind: "$listing" },
      {
        $group: {
          _id: "$listing.product_category",
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Daily revenue trends (last 30 days)
    const revenueTrends = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          status: "completed",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          revenue: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Top revenue generating users (sellers)
    const topSellers = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: "completed",
        },
      },
      {
        $group: {
          _id: "$seller",
          totalRevenue: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          name: "$user.name",
          email: "$user.email",
          totalRevenue: 1,
          transactionCount: 1,
        },
      },
    ]);

    // Peak transaction hours
    const peakHours = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $project: {
          hour: { $hour: "$createdAt" },
          dayOfWeek: { $dayOfWeek: "$createdAt" },
        },
      },
      {
        $group: {
          _id: { hour: "$hour", day: "$dayOfWeek" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Transaction by hour
    const byHour = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $project: {
          hour: { $hour: "$createdAt" },
        },
      },
      {
        $group: {
          _id: "$hour",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Growth rate calculation
    const previousPeriodStart = new Date(
      startDate.getTime() - (endDate.getTime() - startDate.getTime()),
    );
    const previousTransactions = await Transaction.countDocuments({
      createdAt: { $gte: previousPeriodStart, $lt: startDate },
      status: "completed",
    });

    const growthRate =
      previousTransactions > 0
        ? (
            ((stats.count - previousTransactions) / previousTransactions) *
            100
          ).toFixed(2)
        : 100;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          total: totalTransactions,
          completed: stats.count,
          totalValue: stats.totalValue,
          averageValue: stats.avgValue,
          growthRate: parseFloat(growthRate),
        },
        status: byStatus.map((s) => ({ status: s._id, count: s.count })),
        revenue: {
          byCategory: revenueByCategory.map((c) => ({
            category: c._id,
            revenue: c.revenue,
            count: c.count,
          })),
          trends: revenueTrends,
          topSellers,
        },
        patterns: {
          peakHours,
          byHour: byHour.map((h) => ({ hour: h._id, count: h.count })),
        },
      },
    });
  } catch (error) {
    console.error("Error in getTransactionAnalytics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== DELIVERY ANALYTICS ====================

export const getDeliveryAnalytics = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { timeframe = "all", customStart, customEnd } = req.query;
    const { startDate, endDate } = getDateRange(
      timeframe,
      customStart,
      customEnd,
    );

    // Overview
    const totalDeliveries = await Delivery.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Deliveries by status
    const byStatus = await Delivery.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: "$status_delivery", count: { $sum: 1 } } },
    ]);

    // Completed deliveries
    const completedDeliveries = await Delivery.countDocuments({
      status_delivery: "delivered",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Average delivery time (for completed deliveries)
    const deliveryTimeStats = await Delivery.aggregate([
      {
        $match: {
          status_delivery: "delivered",
          deliveryDate: { $exists: true },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $project: {
          deliveryTime: {
            $divide: [
              { $subtract: ["$deliveryDate", "$createdAt"] },
              1000 * 60 * 60 * 24, // Convert to days
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDeliveryDays: { $avg: "$deliveryTime" },
        },
      },
    ]);

    // Delivery partner performance
    const partnerPerformance = await Delivery.aggregate([
      {
        $match: {
          deliveryPartnerId: { $exists: true, $ne: null },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$deliveryPartnerId",
          totalDeliveries: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ["$status_delivery", "delivered"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { totalDeliveries: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "partner",
        },
      },
      { $unwind: "$partner" },
      {
        $project: {
          partnerId: "$_id",
          name: "$partner.name",
          email: "$partner.email",
          totalDeliveries: 1,
          completed: 1,
          completionRate: {
            $multiply: [{ $divide: ["$completed", "$totalDeliveries"] }, 100],
          },
        },
      },
    ]);

    // Unassigned deliveries
    const unassignedDeliveries = await Delivery.countDocuments({
      deliveryPartnerId: null,
    });

    // Deliveries by location
    const byLocation = await Delivery.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $lookup: {
          from: "listings",
          localField: "orderId",
          foreignField: "_id",
          as: "listing",
        },
      },
      { $unwind: "$listing" },
      { $match: { "listing.location": { $exists: true, $ne: "" } } },
      {
        $group: {
          _id: "$listing.location",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Average time in each status
    const statusDuration = await Delivery.aggregate([
      { $match: { statusHistory: { $exists: true, $ne: [] } } },
      { $unwind: "$statusHistory" },
      {
        $group: {
          _id: "$statusHistory.status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Delivery trends (last 30 days)
    const deliveryTrends = await Delivery.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // On-time delivery rate (assuming deliveryDate is the expected date)
    const onTimeDeliveries = await Delivery.countDocuments({
      status_delivery: "delivered",
      // Could add logic to compare actual vs expected delivery date
    });

    const onTimeRate =
      completedDeliveries > 0
        ? ((onTimeDeliveries / completedDeliveries) * 100).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          total: totalDeliveries,
          completed: completedDeliveries,
          avgDeliveryTime: deliveryTimeStats[0]?.avgDeliveryDays || 0,
          onTimeRate: parseFloat(onTimeRate),
          unassigned: unassignedDeliveries,
        },
        status: byStatus.map((s) => ({ status: s._id, count: s.count })),
        partners: {
          performance: partnerPerformance,
        },
        location: byLocation.map((l) => ({ location: l._id, count: l.count })),
        trends: deliveryTrends,
        statusDuration: statusDuration.map((s) => ({
          status: s._id,
          count: s.count,
        })),
      },
    });
  } catch (error) {
    console.error("Error in getDeliveryAnalytics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== CERTIFICATE ANALYTICS ====================

export const getCertificateAnalytics = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { timeframe = "all", customStart, customEnd } = req.query;
    const { startDate, endDate } = getDateRange(
      timeframe,
      customStart,
      customEnd,
    );

    // Overview
    const totalCertificates = await Certificate.countDocuments({
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const pending = await Certificate.countDocuments({
      status: "pending",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const approved = await Certificate.countDocuments({
      status: "approved",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    const disapproved = await Certificate.countDocuments({
      status: "disapproved",
      createdAt: { $gte: startDate, $lte: endDate },
    });

    // Approval rate
    const approvalRate =
      totalCertificates > 0
        ? ((approved / totalCertificates) * 100).toFixed(2)
        : 0;

    // Average approval time
    const approvalTimeStats = await Certificate.aggregate([
      {
        $match: {
          status: "approved",
          updatedAt: { $exists: true },
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $project: {
          approvalTime: {
            $divide: [
              { $subtract: ["$updatedAt", "$createdAt"] },
              1000 * 60 * 60, // Convert to hours
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgApprovalHours: { $avg: "$approvalTime" },
        },
      },
    ]);

    // Certificates by document type
    const byDocType = await Certificate.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: "$documentType", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    // Certificates by issuing authority
    const byAuthority = await Certificate.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: "$issuingAuthority", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Valid vs expired certificates
    const now = new Date();
    const validCertificates = await Certificate.countDocuments({
      "validityPeriod.end": { $gt: now },
      status: "approved",
    });

    const expiredCertificates = await Certificate.countDocuments({
      "validityPeriod.end": { $lte: now },
    });

    // Certificates expiring soon (within 30 days)
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const expiringSoon = await Certificate.countDocuments({
      "validityPeriod.end": { $gt: now, $lte: thirtyDaysFromNow },
      status: "approved",
    });

    // Recyclers with certificates
    const recyclersWithCerts = await Certificate.distinct("uploadby");
    const totalRecyclers = await User.countDocuments({ userType: "recycler" });
    const recyclersWithoutCerts = totalRecyclers - recyclersWithCerts.length;

    // Submission trends
    const submissionTrends = await Certificate.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Validity period distribution
    const validityDistribution = await Certificate.aggregate([
      { $match: { status: "approved" } },
      {
        $project: {
          validityDays: {
            $divide: [
              {
                $subtract: ["$validityPeriod.end", "$validityPeriod.start"],
              },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      {
        $bucket: {
          groupBy: "$validityDays",
          boundaries: [0, 30, 90, 180, 365, 730, 1095, 10000],
          default: "other",
          output: {
            count: { $sum: 1 },
          },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: {
          total: totalCertificates,
          pending,
          approved,
          disapproved,
          approvalRate: parseFloat(approvalRate),
          avgApprovalTime: approvalTimeStats[0]?.avgApprovalHours || 0,
        },
        validity: {
          valid: validCertificates,
          expired: expiredCertificates,
          expiringSoon,
        },
        recyclers: {
          withCertificates: recyclersWithCerts.length,
          withoutCertificates: recyclersWithoutCerts,
          total: totalRecyclers,
        },
        distribution: {
          byDocumentType: byDocType.map((d) => ({
            type: d._id,
            count: d.count,
          })),
          byAuthority: byAuthority.map((a) => ({
            authority: a._id,
            count: a.count,
          })),
          byValidityPeriod: validityDistribution,
        },
        trends: {
          submissions: submissionTrends,
        },
      },
    });
  } catch (error) {
    console.error("Error in getCertificateAnalytics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== TIME-BASED ANALYTICS ====================

export const getTimeBasedAnalytics = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    // Hourly activity (24-hour breakdown)
    const hourlyActivity = await Promise.all([
      // Users by hour
      User.aggregate([
        {
          $project: {
            hour: { $hour: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$hour",
            users: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Listings by hour
      Listing.aggregate([
        {
          $project: {
            hour: { $hour: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$hour",
            listings: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      // Transactions by hour
      Transaction.aggregate([
        {
          $project: {
            hour: { $hour: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$hour",
            transactions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Merge hourly data
    const hourlyMerged = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      users: hourlyActivity[0].find((h) => h._id === hour)?.users || 0,
      listings: hourlyActivity[1].find((h) => h._id === hour)?.listings || 0,
      transactions:
        hourlyActivity[2].find((h) => h._id === hour)?.transactions || 0,
    }));

    // Day of week analysis
    const dayOfWeekActivity = await Promise.all([
      User.aggregate([
        {
          $project: {
            day: { $dayOfWeek: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$day",
            users: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Listing.aggregate([
        {
          $project: {
            day: { $dayOfWeek: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$day",
            listings: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.aggregate([
        {
          $project: {
            day: { $dayOfWeek: "$createdAt" },
          },
        },
        {
          $group: {
            _id: "$day",
            transactions: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayOfWeekMerged = Array.from({ length: 7 }, (_, day) => ({
      day: day + 1,
      dayName: dayNames[day],
      users: dayOfWeekActivity[0].find((d) => d._id === day + 1)?.users || 0,
      listings:
        dayOfWeekActivity[1].find((d) => d._id === day + 1)?.listings || 0,
      transactions:
        dayOfWeekActivity[2].find((d) => d._id === day + 1)?.transactions || 0,
    }));

    // Monthly trends (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyTrends = await Promise.all([
      User.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            users: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Listing.aggregate([
        { $match: { createdAt: { $gte: twelveMonthsAgo } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            listings: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            createdAt: { $gte: twelveMonthsAgo },
            status: "completed",
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m", date: "$createdAt" },
            },
            transactions: { $sum: 1 },
            revenue: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Growth tracking (WoW, MoM, YoY)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const twoYearsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);

    const growthMetrics = await Promise.all([
      // This week vs last week
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.countDocuments({
        createdAt: { $gte: twoWeeksAgo, $lt: weekAgo },
      }),
      // This month vs last month
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      User.countDocuments({
        createdAt: { $gte: twoMonthsAgo, $lt: monthAgo },
      }),
      // This year vs last year
      User.countDocuments({ createdAt: { $gte: yearAgo } }),
      User.countDocuments({
        createdAt: { $gte: twoYearsAgo, $lt: yearAgo },
      }),
    ]);

    const calculateGrowth = (current, previous) => {
      if (previous === 0) return 100;
      return (((current - previous) / previous) * 100).toFixed(2);
    };

    const growth = {
      weekOverWeek: parseFloat(
        calculateGrowth(growthMetrics[0], growthMetrics[1]),
      ),
      monthOverMonth: parseFloat(
        calculateGrowth(growthMetrics[2], growthMetrics[3]),
      ),
      yearOverYear: parseFloat(
        calculateGrowth(growthMetrics[4], growthMetrics[5]),
      ),
    };

    res.status(200).json({
      success: true,
      data: {
        hourly: hourlyMerged,
        dayOfWeek: dayOfWeekMerged,
        monthly: {
          users: monthlyTrends[0],
          listings: monthlyTrends[1],
          transactions: monthlyTrends[2],
        },
        growth,
      },
    });
  } catch (error) {
    console.error("Error in getTimeBasedAnalytics:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== BUSINESS KPI ANALYTICS ====================

export const getBusinessKPIs = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.userType !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { timeframe = "month", customStart, customEnd } = req.query;
    const { startDate, endDate } = getDateRange(
      timeframe,
      customStart,
      customEnd,
    );

    // Daily Active Users (DAU)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dau = await User.countDocuments({ lasLogin: { $gte: oneDayAgo } });

    // Monthly Active Users (MAU)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const mau = await User.countDocuments({
      lasLogin: { $gte: thirtyDaysAgo },
    });

    // Supply vs Demand ratio
    const openListings = await Listing.countDocuments({ status: "open" });
    const activeBids = await Bid.countDocuments({ status: "open" });
    const supplyDemandRatio =
      activeBids > 0 ? (openListings / activeBids).toFixed(2) : 0;

    // Marketplace liquidity (% of listings that get sold)
    const totalListings = await Listing.countDocuments();
    const soldListings = await Listing.countDocuments({ status: "closed" });
    const liquidity =
      totalListings > 0 ? ((soldListings / totalListings) * 100).toFixed(2) : 0;

    // Average days on market
    const avgDaysOnMarket = await Listing.aggregate([
      { $match: { status: "closed" } },
      {
        $project: {
          daysOnMarket: {
            $divide: [
              { $subtract: ["$updatedAt", "$createdAt"] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: "$daysOnMarket" },
        },
      },
    ]);

    // User Lifetime Value (LTV) - average revenue per user
    const ltv = await Transaction.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$seller",
          totalRevenue: { $sum: "$amount" },
        },
      },
      {
        $group: {
          _id: null,
          avgLTV: { $avg: "$totalRevenue" },
        },
      },
    ]);

    // Conversion rates
    const registeredUsers = await User.countDocuments();
    const usersWithListings = await Listing.distinct("seller");
    const usersWithPurchases = await Transaction.distinct("buyer");
    const usersWithBids = await Bid.aggregate([
      { $unwind: "$bids" },
      { $group: { _id: "$bids.bidder" } },
    ]);

    const conversionRates = {
      registrationToListing:
        registeredUsers > 0
          ? ((usersWithListings.length / registeredUsers) * 100).toFixed(2)
          : 0,
      registrationToBid:
        registeredUsers > 0
          ? ((usersWithBids.length / registeredUsers) * 100).toFixed(2)
          : 0,
      registrationToPurchase:
        registeredUsers > 0
          ? ((usersWithPurchases.length / registeredUsers) * 100).toFixed(2)
          : 0,
      listingToSale:
        totalListings > 0
          ? ((soldListings / totalListings) * 100).toFixed(2)
          : 0,
    };

    // Engagement metrics
    const totalChats = await Chat.countDocuments();
    const totalMessages = await Message.countDocuments();
    const activeChats = await Chat.countDocuments({ status: "active" });

    const avgMessagesPerChat =
      totalChats > 0 ? (totalMessages / totalChats).toFixed(2) : 0;

    res.status(200).json({
      success: true,
      data: {
        platformHealth: {
          dau,
          mau,
          dauMauRatio: mau > 0 ? ((dau / mau) * 100).toFixed(2) : 0,
        },
        marketplace: {
          supplyDemandRatio: parseFloat(supplyDemandRatio),
          liquidity: parseFloat(liquidity),
          avgDaysOnMarket: avgDaysOnMarket[0]?.avgDays || 0,
        },
        userValue: {
          ltv: ltv[0]?.avgLTV || 0,
        },
        conversion: {
          registrationToListing: parseFloat(
            conversionRates.registrationToListing,
          ),
          registrationToBid: parseFloat(conversionRates.registrationToBid),
          registrationToPurchase: parseFloat(
            conversionRates.registrationToPurchase,
          ),
          listingToSale: parseFloat(conversionRates.listingToSale),
        },
        engagement: {
          totalChats,
          activeChats,
          totalMessages,
          avgMessagesPerChat: parseFloat(avgMessagesPerChat),
        },
      },
    });
  } catch (error) {
    console.error("Error in getBusinessKPIs:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ==================== PUBLIC USER PROFILE ====================
// Any authenticated user can view curated (privacy-safe) stats for a seller or buyer.
// No revenue amounts, no contact info — just trust signals.
export const getPublicUserProfile = async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    const { userId } = req.params;
    const oid = new mongoose.Types.ObjectId(userId);

    const user = await User.findById(userId).select("name avatar userType createdAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    const accountAgeDays = Math.floor(
      (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    // ── SELLER (userType: "user") ──────────────────────────────────────────────
    if (user.userType === "user") {
      const [totalListings, openListings, closedListings] = await Promise.all([
        Listing.countDocuments({ seller: userId }),
        Listing.countDocuments({ seller: userId, status: "open" }),
        Listing.countDocuments({ seller: userId, status: "closed" }),
      ]);

      const salesData = await Transaction.aggregate([
        { $match: { seller: oid, status: "completed" } },
        { $group: { _id: null, count: { $sum: 1 }, avgSale: { $avg: "$amount" } } },
      ]);
      const sales = salesData[0] || { count: 0, avgSale: 0 };

      const bidsReceivedData = await Bid.aggregate([
        {
          $lookup: {
            from: "listings", localField: "listing",
            foreignField: "_id", as: "listingDoc",
          },
        },
        { $unwind: "$listingDoc" },
        { $match: { "listingDoc.seller": oid } },
        { $unwind: "$bids" },
        { $group: { _id: null, total: { $sum: 1 } } },
      ]);
      const bidsReceived = bidsReceivedData[0]?.total || 0;

      const categoryBreakdown = await Listing.aggregate([
        { $match: { seller: oid } },
        { $group: { _id: "$product_category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]);

      const recentListings = await Listing.find({ seller: userId })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("product_category brand model price status createdAt image_paths");

      return res.status(200).json({
        success: true,
        data: {
          user: { name: user.name, avatar: user.avatar, userType: user.userType },
          accountAgeDays,
          roleType: "user",
          stats: {
            listings: {
              total: totalListings,
              open: openListings,
              closed: closedListings,
              completionRate: totalListings > 0
                ? parseFloat(((closedListings / totalListings) * 100).toFixed(1))
                : 0,
            },
            sales: { count: sales.count, avgSale: Math.round(sales.avgSale) },
            bidsReceived,
          },
          categoryBreakdown: categoryBreakdown.map((c) => ({
            category: c._id || "Other", count: c.count,
          })),
          recentListings,
        },
      });
    }

    // ── BUYER / RECYCLER ───────────────────────────────────────────────────────
    if (user.userType === "recycler") {
      const bidsData = await Bid.aggregate([
        { $unwind: "$bids" },
        { $match: { "bids.bidder": oid } },
        { $group: { _id: null, total: { $sum: 1 }, avg: { $avg: "$bids.amount" } } },
      ]);
      const bids = bidsData[0] || { total: 0, avg: 0 };

      const purchaseData = await Transaction.aggregate([
        { $match: { buyer: oid, status: "completed" } },
        { $group: { _id: null, count: { $sum: 1 }, avgPurchase: { $avg: "$amount" } } },
      ]);
      const purchases = purchaseData[0] || { count: 0, avgPurchase: 0 };

      const pendingPayments = await Transaction.countDocuments({ buyer: oid, status: "pending" });
      const paymentCompletionRate = (purchases.count + pendingPayments) > 0
        ? parseFloat(((purchases.count / (purchases.count + pendingPayments)) * 100).toFixed(1))
        : 100;

      const winRate = bids.total > 0
        ? parseFloat(((purchases.count / bids.total) * 100).toFixed(1))
        : 0;

      const bidCategories = await Bid.aggregate([
        { $unwind: "$bids" },
        { $match: { "bids.bidder": oid } },
        {
          $lookup: {
            from: "listings", localField: "listing",
            foreignField: "_id", as: "listingDoc",
          },
        },
        { $unwind: "$listingDoc" },
        { $group: { _id: "$listingDoc.product_category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]);

      const approvedCerts = await Certificate.countDocuments({
        uploadby: userId, status: "approved",
      });
      const hasCertificate = approvedCerts > 0;

      const deliveriesCompleted = await Delivery.countDocuments({
        buyerId: userId, status_delivery: "delivered",
      });

      return res.status(200).json({
        success: true,
        data: {
          user: { name: user.name, avatar: user.avatar, userType: user.userType },
          accountAgeDays,
          roleType: "recycler",
          stats: {
            bids: { total: bids.total, winRate, avgBid: Math.round(bids.avg) },
            purchases: { count: purchases.count, avgPurchase: Math.round(purchases.avgPurchase) },
            paymentCompletionRate,
            hasCertificate,
            deliveriesCompleted,
          },
          bidCategories: bidCategories.map((c) => ({
            category: c._id || "Other", count: c.count,
          })),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: { name: user.name, avatar: user.avatar, userType: user.userType },
        accountAgeDays,
        roleType: user.userType,
        stats: {},
      },
    });
  } catch (error) {
    console.error("Error in getPublicUserProfile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
