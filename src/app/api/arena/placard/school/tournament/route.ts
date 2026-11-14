import { parseKqSchoolTournamentCommand } from '@/lib/kanab-quest-school-tournament';
import { KqSchoolError } from '@/lib/kanab-quest-school-server';
import { getKqSchoolTournament } from '@/lib/supabase/kanab-quest-school-tournament-backend';
import { readSchoolBody, schoolRequest } from '../_request';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return schoolRequest(request, ownerId => getKqSchoolTournament(ownerId));
}

export async function POST(request: Request) {
  return schoolRequest(request, async ownerId => {
    const command = parseKqSchoolTournamentCommand(await readSchoolBody(request));
    if (!command) throw new KqSchoolError('Action de tournoi invalide.', 400, 'school_tournament_invalid');
    return getKqSchoolTournament(ownerId, command);
  });
}
