const admin = require('firebase-admin');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "unnati-powerprep",
            clientEmail: "firebase-adminsdk-fbsvc@unnati-powerprep.iam.gserviceaccount.com",
            privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC9YAkGAjZAkl8G\n/XjG75Wu5uuNBcqN++eNbZ51ojgH5DyG9PRaP7r3MUVJoI8S0KyVnmWGyBXkyiFv\nmi7wsrm1o+RUKd77fK5I4C3SXYY7iX+bhiOs9kmfHevaLjtYgKey1YBvmbFnnxUW\nyKQM+jOc9LnKA7r7PYh9DMaAac7i2/8YSLR/jQjrDM0rXL/M+GwFaatQNYNK54oU\nT3H4akC0lOrYCdDbytE8K6BiVMXoyFV9rHRYX1D+If62Dvu04mO742Cj2p64SZED\nGYo8vUBKLM+nXgD/mLzw40h3ut5WA3pTYv0g80vkoqJPG6dt7TPv951csI0XzN6d\ni2mUK04dAgMBAAECggEAAiRzDggbop+BHX23VsoGhIAh+STGWJHye1YMrgY4w2ZE\nBPFbZNhT8dNO70saxgohfCIuMWBvy6qSsJER8utHN6aDSW8onOnF/BxVqnVuLxZf\n45CYo7m9eNOMl0YjtP7C6bNXoZriReJfg+Y7DhnrpjXwjOpGGySFvXw/n2xpRenE\nuSMDF2rgyvaQXsLg4EzXb94woRn7vcBbWt+ZtYKxvrqedHL3U6GS8CrVFi5JIU9k\n6/+BZFuifw1sCO+rGWTQ37AZR2Zh7zlC9lI/RbiHoYg7cqEtdf4+sR+wjcV0UFd0\nJ0z6VzkukSWD3dJB4iWfdhaxazHdhdLk1OpBaVtPAwKBgQDh6VvvUUL4ytBz+Dza\n4H3nfUyffT+ty9kltq7BpseFMy3GAkk4hvA762ymer4RsPPlspmGwZ/D0fhutxkm\nk3hbc+r5/n0WhGiaa9nCxKuyQA3eL7sb7DltsKrMj5C7y9e9uiQg6/rCiP7cJFfX\npgQUlT76V2xV+ZgGVggGrSWcIwKBgQDWmO/Mi9W/tsUlodiB7/3Le7q5GEdp1+0Y\nYC4hVPjHOBtCjRjF6coLrjAPWGvg7+lncEBJ5SYquzEXUnq/h1VEjgr/c2SnD8YO\niYAgttJIkB/SJYFALCHBMDDRok8NGtYMGW3aV+tnzea5pKF9crSKntUAE5Z9tXaX\nPHyKXInwvwKBgFrWapEgK72+T3NSLaYU/otGZrj6s9A+V2JCwqI7XZ7BpXYpFSgV\nmiN91oJaeHLEpE2IMxNsZ8FlfG+IUCSix5J+Wc2L9uBG/YiaNUWLrz5NY0YkCyh/\nI9hnYUY/tALPRECVyFE0kfAHBfOe6XNc3eco29ntrTIk2mwxy6hjluvhAoGBANTY\nd+/fOjCerUe4ETA/wvBSVk9D34EBo64rp1V0HBQseA04OTwDuFyBdjWiM82050Gr\nOniQiZyUcgp5yjmxl0cZw5q+7zQsFvtQMf9Ala1XFdivTlVB8HDWxXUHkXSkC22Q\nwz5vOZOJy7CRs4LjhGKBSy56PyeMFoXGfpgVVNOtAoGAJmlKXBh3mMYx9/MCxk6/\ndRYOpSZIPXFhWGQe6AKrRyXPHzE3RM1powX9MpEYH7SkVgkoDIEmhOMUB8ZcVuBh\nIr4MsD1cPE7qxj/Tufo/+xD8u3KSl3j4oT0znqzqhILKurv9IJA9tPQe+KHpgK3k\n0I8W7CulrhpZ+13ckZiLiK8=\n-----END PRIVATE KEY-----\n".replace(/\\n/g, '\n'),
        }),
    });
}

const db = admin.firestore();

async function backfill() {
    const userId = "Blcw7tDn9AeEnKLHqwkZ1UeILxn2"; // Unnati tiwari's ID
    const instCode = "HPBBJA";
    const password = "Unnati@4702";

    await db.collection('users').doc(userId).update({
        instCode,
        password,
        updatedAt: new Date().toISOString()
    });

    console.log("Backfill complete for Unnati tiwari");
}

backfill().catch(console.error);
