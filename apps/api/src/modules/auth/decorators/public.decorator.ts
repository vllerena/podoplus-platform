import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Decorator para marcar endpoints públicos que no requieren JWT
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
