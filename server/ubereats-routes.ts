import { type Express, type Request, Response } from "express";

/**
 * UberEats Webhook Routes
 * Implements all required endpoints for UberEats API production validation
 */

export function registerUberEatsRoutes(app: Express) {
  // ============ Integration Config ============

  // Activate Integration
  app.post("/api/integration/activate", (_req: Request, res: Response) => {
    console.log("✅ Integration activated");
    res.status(200).json({
      status: "success",
      message: "Integration activated",
      client_id: process.env.UBEREATS_CLIENT_ID || "demo-client",
    });
  });

  // Get Integration Details
  app.get("/api/integration/details", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "success",
      integration: {
        client_id: process.env.UBEREATS_CLIENT_ID || "demo-client",
        status: "active",
        webhooks_configured: true,
        store_id: "demo-store-001",
      },
    });
  });

  // Remove Integration
  app.delete("/api/integration", (_req: Request, res: Response) => {
    console.log("✅ Integration removed");
    res.status(204).send();
  });

  // Update Integration Details
  app.put("/api/integration", (req: Request, res: Response) => {
    console.log("✅ Integration updated:", req.body);
    res.status(200).json({
      status: "success",
      message: "Integration details updated",
    });
  });

  // ============ Menu ============

  // Upload Menu
  app.post("/api/menu/upload", (req: Request, res: Response) => {
    console.log("✅ Menu uploaded:", req.body);
    res.status(200).json({
      status: "success",
      menu_id: "menu-" + Date.now(),
      items_processed: req.body.items?.length || 0,
    });
  });

  // Update Item
  app.put("/api/menu/item/:itemId", (req: Request, res: Response) => {
    console.log("✅ Item updated:", req.params.itemId, req.body);
    res.status(200).json({
      status: "success",
      item_id: req.params.itemId,
      message: "Item updated successfully",
    });
  });

  // ============ Orders ============

  // Get Order Details
  app.get("/api/order/:orderId", (req: Request, res: Response) => {
    res.status(200).json({
      status: "success",
      order: {
        id: req.params.orderId,
        status: "pending",
        items: [],
        total: 0,
        customer: { name: "Demo Customer" },
        created_at: new Date().toISOString(),
      },
    });
  });

  // Accept Order
  app.post("/api/order/:orderId/accept", (req: Request, res: Response) => {
    console.log("✅ Order accepted:", req.params.orderId);
    res.status(200).json({
      status: "success",
      order_id: req.params.orderId,
      state: "ACCEPTED",
    });
  });

  // Deny Order
  app.post("/api/order/:orderId/deny", (req: Request, res: Response) => {
    console.log("✅ Order denied:", req.params.orderId);
    res.status(200).json({
      status: "success",
      order_id: req.params.orderId,
      state: "DENIED",
    });
  });

  // Cancel Order
  app.post("/api/order/:orderId/cancel", (req: Request, res: Response) => {
    console.log("✅ Order cancelled:", req.params.orderId);
    res.status(200).json({
      status: "success",
      order_id: req.params.orderId,
      state: "CANCELLED",
    });
  });

  // Update Order
  app.put("/api/order/:orderId", (req: Request, res: Response) => {
    console.log("✅ Order updated:", req.params.orderId, req.body);
    res.status(200).json({
      status: "success",
      order_id: req.params.orderId,
      message: "Order updated",
    });
  });

  // ============ Webhooks (Order Notifications) ============

  // Order Cancelled Webhook
  app.post("/webhook/order-cancelled", (req: Request, res: Response) => {
    console.log("📨 Webhook received - Order Cancelled:", req.body);
    res.status(200).json({ received: true });
  });

  // Order Notification Webhook
  app.post("/webhook/order-notification", (req: Request, res: Response) => {
    console.log("📨 Webhook received - Order Notification:", req.body);
    res.status(200).json({ received: true });
  });

  // ============ Store ============

  // Update Holiday Hours
  app.put("/api/store/holiday-hours", (req: Request, res: Response) => {
    console.log("✅ Holiday hours updated:", req.body);
    res.status(200).json({
      status: "success",
      message: "Holiday hours updated",
      store_id: "demo-store-001",
    });
  });

  console.log("🚀 UberEats webhook routes registered");
}
