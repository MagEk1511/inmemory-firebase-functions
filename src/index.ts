import * as functions from "firebase-functions";
import {HttpsError} from "firebase-functions/https";
import {Timestamp} from "firebase-admin/firestore";
import axios from "axios";
import * as admin from "firebase-admin";
import {z} from "zod";


admin.initializeApp();
const db = admin.firestore();

const requestSchema = z.object({
  name: z.string().min(1, "name is required"),
  avatar_image_url: z.string().min(1, "imageUrl is required"),
  cover_image_url: z.string(),
  voice_id: z.string().uuid(),
  knowledge: z.object({
    name: z.string().min(1, "knowledgeName is required"),
    description: z.string().min(1, "knowledgeDescription is required"),
    base_knowledge: z.string().min(1, "knowledgePlaintext is required"),
  }),
  api_key: z.string().min(1, "api_key is required"),
});

const authenticate = async (req: functions.https.Request) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HttpsError("unauthenticated", "Authentication is required");
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    throw new HttpsError("unauthenticated", "Invalid token");
  }
};

const createKnowledge = async (
  knowledgeData: { name: string; description: string; base_knowledge: string },
  apiKey: string
) => {
  try {
    const knowledgeCreateUrl = "https://api.d-id.com/knowledge";
    const base64apiKey = Buffer.from(apiKey).toString("base64");
    const response = await axios.post(knowledgeCreateUrl, knowledgeData, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + base64apiKey,
      },
    });
    return response.data.id;
  } catch (error) {
    console.error("Error calling external API:", error);
    throw new HttpsError(
      "internal",
      "Failed to create Knowledge in external API"
    );
  }
};

const createAgent = async (
  agentData: {type: "talk", source_url: string, thumbnail: string, knowledge: {id: string}},
  apiKey: string
) => {
  try {
    const agentCreateUrl = "https://api.d-id.com/agents";
    const base64apiKey = Buffer.from(apiKey).toString("base64");
    const response = await axios.post(agentCreateUrl, agentData, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + base64apiKey,
      },
    });
    return response.data.id;
  } catch (error) {
    console.error("Error calling external API:", error);
    throw new HttpsError(
      "internal",
      "Failed to create Knowledge in external API"
    );
  }
};

export const createAvatar = functions.https.onRequest( async (req, res) => {
  try {
    const userId = await authenticate(req);

    const parseBody = requestSchema.safeParse(req.body);

    if (!parseBody.success) {
      res.status(400).json({
        error: "Validation error",
        details: parseBody.error.format(),
      });
      return;
    }

    // eslint-disable-next-line camelcase
    const {knowledge, api_key} = parseBody.data;

    const createdAt: Timestamp = Timestamp.now();

    const docRef = db.collection("avatars").add({
      ...parseBody.data,
      userId,
      status: "pending",
      createdAt,
    });

    console.log((await docRef).id);

    const knowledgeId = await createKnowledge(knowledge, api_key);

    const agentId = await createAgent({
      type: "talk",
      source_url: parseBody.data.avatar_image_url,
      thumbnail: parseBody.data.cover_image_url,
      knowledge: {
        id: knowledgeId,
      },
    }, api_key);

    (await docRef).update({
      knowledgeId,
      agentId,
      status: "created",
    });

    res.status(201).json({
      recordId: (await docRef).id,
    });
  } catch (error) {
    console.error("Error:", error);
    if (error instanceof HttpsError) {
      res.status(error.code === "unauthenticated" ? 401 : 400)
        .json({error: error.message});
    } else {
      res.status(500).json({error: "Internal server error"});
    }
  }
}
);
