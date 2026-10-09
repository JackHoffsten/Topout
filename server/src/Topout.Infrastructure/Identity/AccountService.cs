using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Topout.Application.Accounts;
using Topout.Application.Common;
using Topout.Infrastructure.Persistence;

namespace Topout.Infrastructure.Identity;

internal sealed class AccountService(
    AppDbContext db,
    UserManager<ApplicationUser> users,
    SignInManager<ApplicationUser> signIn
) : IAccountService
{
    public async Task DeleteAsync(int userId, string password, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null)
            throw new RequestException(ErrorKind.Unauthorized, "Please sign in again.");
        if (
            string.IsNullOrEmpty(password)
            || password.Length > 256
            || !(
                await signIn.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true)
            ).Succeeded
        )
            throw new RequestException(
                ErrorKind.Validation,
                "Your password could not be verified."
            );
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Remove referencing aggregates before templates/exercises with restricted foreign keys.
        // Nested records, Identity records and refresh sessions cascade in the database.
        await db.ScheduledWorkouts.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.WorkoutLogs.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.WorkoutDays.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Exercises.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.ClimbLogs.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.ClimbingDayMarks.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.ClimbProjects.Where(x => x.UserId == userId).ExecuteDeleteAsync(ct);
        await db.Users.Where(x => x.Id == userId).ExecuteDeleteAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
