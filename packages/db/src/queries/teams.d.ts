import type { TeamMember, TeamInvite } from '../../generated';
export type { TeamMember, TeamInvite };
export interface TeamMemberWithUser extends TeamMember {
    member: {
        id: string;
        email: string;
        name: string | null;
    };
}
export declare function getTeamMembers(ownerId: string): Promise<TeamMemberWithUser[]>;
export declare function addTeamMember(ownerId: string, userId: string, role: string): Promise<TeamMember>;
export declare function removeTeamMember(ownerId: string, memberId: string): Promise<void>;
export declare function getTeamInvites(ownerId: string): Promise<TeamInvite[]>;
export declare function createTeamInvite(ownerId: string, email: string, role: string): Promise<TeamInvite>;
export declare function acceptTeamInvite(token: string): Promise<TeamInvite | null>;
export declare function isTeamMemberOf(ownerId: string, userId: string): Promise<boolean>;
//# sourceMappingURL=teams.d.ts.map