import type { CleanErrorCode } from "@/types/image";

/**
 * User-facing failure copy, in its own module so the client can import the
 * messages without pulling the server-side validation schema (and Zod) into
 * the browser bundle.
 *
 * Every message says what happened and what to do next. None of them shows a
 * status code, and each one reaffirms that nothing was kept, because that is
 * the question a user of a privacy tool actually has when something fails.
 */
export const ERROR_MESSAGES: Record<CleanErrorCode, string> = {
  no_file: "No image was attached to the request. Choose a file and try again.",
  unsupported_type: "That file type isn't supported. Please upload a JPG, PNG, or WebP image.",
  too_large: "This image is larger than the maximum allowed size.",
  empty_file: "That file is empty. Please choose an image with content in it.",
  corrupt_image:
    "This file looks like an image but couldn't be decoded. It may be truncated or damaged.",
  too_many_pixels: "This image has too many pixels to process safely. Try a smaller version.",
  timeout: "Processing took too long and was stopped. Your file wasn't saved.",
  rate_limited: "You've sent a lot of images in a short time. Please wait a moment and try again.",
  bad_request: "That request wasn't valid. Please reload the page and try again.",
  server_error:
    "Something went wrong while processing this image. Your file wasn't saved. Please try again.",
};

export interface ValidationFailure {
  code: CleanErrorCode;
  message: string;
}

export function failure(code: CleanErrorCode, message?: string): ValidationFailure {
  return { code, message: message ?? ERROR_MESSAGES[code] };
}
