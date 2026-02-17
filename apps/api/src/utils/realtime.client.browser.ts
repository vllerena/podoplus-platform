// /**
//  * Cliente Realtime para usar SOLO en navegador/frontend
//  * NO usar en NestJS backend
//  */

// export interface RealtimeClientConfig {
//   url?: string;
//   userId?: string;
//   reconnection?: boolean;
//   reconnectionDelay?: number;
//   reconnectionDelayMax?: number;
//   reconnectionAttempts?: number;
// }

// export class RealtimeClient {
//   private socket: any;
//   private userId: string;
//   private url: string;
//   private isConnected: boolean = false;

//   constructor(config: RealtimeClientConfig = {}) {
//     this.url = config.url || "http://localhost:3000";
//     this.userId = config.userId || this.getUserId() || "";
//   }

//   private getUserId(): string | null {
//     try {
//       return localStorage.getItem("userId");
//     } catch (error) {
//       console.warn("localStorage not available:", error);
//     }
//     return null;
//   }

//   async connect(): Promise<void> {
//     return new Promise(async (resolve, reject) => {
//       try {
//         const { io } = await import("socket.io-client");

//         this.socket = io(`${this.url}/realtime`, {
//           auth: {
//             userId: this.userId,
//           },
//           reconnection: true,
//           reconnectionDelay: 1000,
//           reconnectionDelayMax: 5000,
//           reconnectionAttempts: 5,
//         });

//         this.socket.on("connect", () => {
//           this.isConnected = true;
//           console.log("Connected to realtime server");
//           resolve();
//         });

//         this.socket.on("connect_error", (error: any) => {
//           console.error("Connection error:", error);
//           reject(error);
//         });

//         this.socket.on("error", (error: any) => {
//           console.error("Socket error:", error);
//         });

//         this.socket.on("disconnect", () => {
//           this.isConnected = false;
//           console.log("Disconnected from realtime server");
//         });
//       } catch (error) {
//         reject(error);
//       }
//     });
//   }

//   disconnect() {
//     if (this.socket) {
//       this.socket.disconnect();
//       this.isConnected = false;
//     }
//   }

//   isConnectedStatus(): boolean {
//     return this.isConnected;
//   }

//   subscribeBranch(branchId: string) {
//     if (!this.isConnected) {
//       console.warn("Not connected to realtime server");
//       return;
//     }
//     this.socket.emit("subscribe:branch", { branchId });
//   }

//   unsubscribeBranch(branchId: string) {
//     if (!this.isConnected) return;
//     this.socket.emit("unsubscribe:branch", { branchId });
//   }

//   subscribeCustomer(customerId: string) {
//     if (!this.isConnected) {
//       console.warn("Not connected to realtime server");
//       return;
//     }
//     this.socket.emit("subscribe:customer", { customerId });
//   }

//   unsubscribeCustomer(customerId: string) {
//     if (!this.isConnected) return;
//     this.socket.emit("unsubscribe:customer", { customerId });
//   }

//   on(event: string, callback: (data: any) => void) {
//     if (!this.socket) {
//       console.warn("Socket not initialized");
//       return;
//     }
//     this.socket.on(event, callback);
//   }

//   off(event: string, callback?: (data: any) => void) {
//     if (!this.socket) return;
//     if (callback) {
//       this.socket.off(event, callback);
//     } else {
//       this.socket.off(event);
//     }
//   }

//   onHoldCreated(callback: (data: any) => void) {
//     this.on("hold:created", callback);
//   }

//   offHoldCreated(callback: (data: any) => void) {
//     this.off("hold:created", callback);
//   }

//   onHoldReleased(callback: (data: any) => void) {
//     this.on("hold:released", callback);
//   }

//   offHoldReleased(callback: (data: any) => void) {
//     this.off("hold:released", callback);
//   }

//   onHoldExpired(callback: (data: any) => void) {
//     this.on("hold:expired", callback);
//   }

//   offHoldExpired(callback: (data: any) => void) {
//     this.off("hold:expired", callback);
//   }

//   onHoldRenewed(callback: (data: any) => void) {
//     this.on("hold:renewed", callback);
//   }

//   offHoldRenewed(callback: (data: any) => void) {
//     this.off("hold:renewed", callback);
//   }

//   onAppointmentCreated(callback: (data: any) => void) {
//     this.on("appointment:created", callback);
//   }

//   offAppointmentCreated(callback: (data: any) => void) {
//     this.off("appointment:created", callback);
//   }

//   onAppointmentConfirmed(callback: (data: any) => void) {
//     this.on("appointment:confirmed", callback);
//   }

//   offAppointmentConfirmed(callback: (data: any) => void) {
//     this.off("appointment:confirmed", callback);
//   }

//   onAppointmentCheckedIn(callback: (data: any) => void) {
//     this.on("appointment:checked_in", callback);
//   }

//   offAppointmentCheckedIn(callback: (data: any) => void) {
//     this.off("appointment:checked_in", callback);
//   }

//   onAppointmentInService(callback: (data: any) => void) {
//     this.on("appointment:in_service", callback);
//   }

//   offAppointmentInService(callback: (data: any) => void) {
//     this.off("appointment:in_service", callback);
//   }

//   onAppointmentCompleted(callback: (data: any) => void) {
//     this.on("appointment:completed", callback);
//   }

//   offAppointmentCompleted(callback: (data: any) => void) {
//     this.off("appointment:completed", callback);
//   }

//   onAppointmentCanceled(callback: (data: any) => void) {
//     this.on("appointment:canceled", callback);
//   }

//   offAppointmentCanceled(callback: (data: any) => void) {
//     this.off("appointment:canceled", callback);
//   }

//   onAppointmentRescheduled(callback: (data: any) => void) {
//     this.on("appointment:rescheduled", callback);
//   }

//   offAppointmentRescheduled(callback: (data: any) => void) {
//     this.off("appointment:rescheduled", callback);
//   }

//   onAppointmentNoShow(callback: (data: any) => void) {
//     this.on("appointment:no_show", callback);
//   }

//   offAppointmentNoShow(callback: (data: any) => void) {
//     this.off("appointment:no_show", callback);
//   }

//   onAvailabilityUpdated(callback: (data: any) => void) {
//     this.on("availability:updated", callback);
//   }

//   offAvailabilityUpdated(callback: (data: any) => void) {
//     this.off("availability:updated", callback);
//   }

//   ping(): Promise<boolean> {
//     return new Promise((resolve) => {
//       if (!this.socket) {
//         resolve(false);
//         return;
//       }
//       this.socket.emit("ping", (response: any) => {
//         resolve(response?.pong === true);
//       });
//     });
//   }
// }

// export default RealtimeClient;
