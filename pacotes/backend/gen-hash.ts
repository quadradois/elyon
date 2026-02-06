import bcrypt from 'bcrypt';

async function main() {
    const hash = await bcrypt.hash('Admin123!', 10);
    console.log('HASH:', hash);
}

main();
