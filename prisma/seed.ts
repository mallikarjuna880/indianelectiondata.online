import { PrismaClient, ElectionType, SourceStatus } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.resultSource.deleteMany();
  await prisma.candidateResult.deleteMany();
  await prisma.constituencyStatistic.deleteMany();
  await prisma.constituencyVersion.deleteMany();
  await prisma.dataSource.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.party.deleteMany();
  await prisma.constituency.deleteMany();
  await prisma.state.deleteMany();
  await prisma.election.deleteMany();

  const [telangana, andhra] = await Promise.all([
    prisma.state.create({ data: { name: 'Telangana', abbreviation: 'TS', stateCode: '36' } }),
    prisma.state.create({ data: { name: 'Andhra Pradesh', abbreviation: 'AP', stateCode: '37' } })
  ]);

  const election = await prisma.election.create({ data: { name: 'Development Seed Election 2024', electionType: ElectionType.LOK_SABHA, year: 2024, electionDate: new Date('2024-05-13T00:00:00Z'), description: 'Local development seed data only. Replace with verified official election data before publication.', sourceStatus: SourceStatus.PUBLISHED } });
  const source = await prisma.dataSource.create({ data: { name: 'Development seed source', organization: 'Indian Election Data', sourceType: 'DEVELOPMENT', url: 'https://indianelectiondata.online' } });
  const [partyA, partyB] = await Promise.all([
    prisma.party.create({ data: { name: 'Development Party A', abbreviation: 'DPA' } }),
    prisma.party.create({ data: { name: 'Development Party B', abbreviation: 'DPB' } })
  ]);
  const [candidateA, candidateB, candidateC] = await Promise.all([
    prisma.candidate.create({ data: { name: 'Development Candidate A' } }),
    prisma.candidate.create({ data: { name: 'Development Candidate B' } }),
    prisma.candidate.create({ data: { name: 'Development Candidate C' } })
  ]);
  const c1 = await prisma.constituency.create({ data: { name: 'Development Constituency North', stateId: telangana.id, latitude: 17.3850, longitude: 78.4867 } });
  const c2 = await prisma.constituency.create({ data: { name: 'Development Constituency South', stateId: andhra.id, latitude: 16.5062, longitude: 80.6480 } });
  const [v1, v2] = await Promise.all([
    prisma.constituencyVersion.create({ data: { constituencyId: c1.id, electionId: election.id, name: c1.name, constituencyNumber: 1, delimitationVersion: 'DEVELOPMENT' } }),
    prisma.constituencyVersion.create({ data: { constituencyId: c2.id, electionId: election.id, name: c2.name, constituencyNumber: 2, delimitationVersion: 'DEVELOPMENT' } })
  ]);
  const results = await prisma.candidateResult.createMany({ data: [
    { electionId: election.id, constituencyVersionId: v1.id, candidateId: candidateA.id, partyId: partyA.id, votes: 60000, voteShare: 60, position: 1, isWinner: true },
    { electionId: election.id, constituencyVersionId: v1.id, candidateId: candidateB.id, partyId: partyB.id, votes: 40000, voteShare: 40, position: 2, isWinner: false },
    { electionId: election.id, constituencyVersionId: v2.id, candidateId: candidateB.id, partyId: partyB.id, votes: 55000, voteShare: 55, position: 1, isWinner: true },
    { electionId: election.id, constituencyVersionId: v2.id, candidateId: candidateC.id, partyId: null, votes: 45000, voteShare: 45, position: 2, isWinner: false }
  ] });
  const created = await prisma.candidateResult.findMany({ where: { electionId: election.id } });
  await prisma.resultSource.createMany({ data: created.map(r => ({ resultId: r.id, sourceId: source.id })) });
  await prisma.constituencyStatistic.createMany({ data: [
    { electionId: election.id, constituencyVersionId: v1.id, electors: 120000, votesPolled: 100000, validVotes: 100000, notaVotes: 1000, turnoutPercentage: 83.3333 },
    { electionId: election.id, constituencyVersionId: v2.id, electors: 110000, votesPolled: 100000, validVotes: 100000, notaVotes: 900, turnoutPercentage: 90.9091 }
  ] });
  console.log(`Seeded development dataset: ${results.count} results`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
