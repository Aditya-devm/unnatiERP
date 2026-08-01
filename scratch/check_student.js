const { getAdminDb } = require('./lib/firebase/admin');

async function checkStudent() {
    const db = getAdminDb();
    const name = "Unnati tiwari";
    const instCode = "HPBBJA";
    const rollNo = "4702";
    const password = "Unnati@4702";

    console.log(`Checking for student: ${name}`);
    console.log(`Expected credentials: InstCode: ${instCode}, RollNo: ${rollNo}, Password: ${password}`);

    const snapshot = await db.collection('users')
        .where('name', '>=', 'Unnati')
        .where('name', '<=', 'Unnati' + '\uf8ff')
        .get();

    if (snapshot.empty) {
        console.log("No users found starting with 'Unnati'");
        return;
    }

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log("--- Found User ---");
        console.log("ID:", doc.id);
        console.log("Name:", data.name);
        console.log("Role:", data.role);
        console.log("InstCode:", data.instCode);
        console.log("RollNo:", data.rollNo);
        console.log("Password:", data.password);
        console.log("Batch:", data.batchId);
        
        const matchInst = data.instCode === instCode;
        const matchRoll = String(data.rollNo) === String(rollNo);
        const matchPass = data.password === password;

        console.log("Match InstCode:", matchInst);
        console.log("Match RollNo:", matchRoll);
        console.log("Match Password:", matchPass);
    });
}

checkStudent().catch(console.error);
