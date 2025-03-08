/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";
import {z} from "zod";


admin.initializeApp();
const db = admin.firestore();

const requestSchema = z.object({
  name: z.string().min(1, "name is required"),
  avatarImageUrl: z.string().min(1, "imageUrl is required"),
  coverImageUrl: z.string(),
  voiceId: z.string().uuid(),
  knowledge: z.object({
    name: z.string().min(1, "knowledgeName is required"),
    description: z.string().min(1, "knowledgeDescription is required"),
    plaintext: z.string().min(1, "knowledgePlaintext is required"),
  }),
});

export const createAvatar = functions.https.onRequest( async (req, res) => {
  const parseBody = requestSchema.safeParse(req.body);

  if (!parseBody.success) {
    return res.status(400).json({
      error: "Validation error",
      details: parseBody.error.format(),
    });
  }

  const {name, avatarImageUrl, coverImageUrl, voiceId, knowledge} = parseBody.data;
);
