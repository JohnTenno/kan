// Creates the storage buckets Kan needs. Safe to run on every deploy.
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "us-east-1",
  endpoint: process.env.S3_INTERNAL_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
});

const avatars = process.env.AVATAR_BUCKET;
const attachments = process.env.ATTACHMENTS_BUCKET;

async function ensureBucket(bucket) {
  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`bucket ${bucket}: ya existe`);
      return;
    } catch (err) {
      const status = err.$metadata?.httpStatusCode;
      if (status === 404) {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
        console.log(`bucket ${bucket}: creado`);
        return;
      }
      // The storage server may still be starting.
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`no se pudo conectar al almacenamiento para ${bucket}`);
}

await ensureBucket(avatars);
await ensureBucket(attachments);

// Avatars are shown with plain <img> URLs, so they must be publicly readable.
// Attachments stay private and are served through signed URLs.
await client.send(
  new PutBucketPolicyCommand({
    Bucket: avatars,
    Policy: JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${avatars}/*`],
        },
      ],
    }),
  }),
);
console.log(`bucket ${avatars}: lectura pública`);
