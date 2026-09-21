namespace Topout.Infrastructure.Identity;

// A session is a token family. Revocation invalidates every refresh token in the family.
public sealed class RefreshSession
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
}
