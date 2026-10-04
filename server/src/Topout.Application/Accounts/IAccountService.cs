namespace Topout.Application.Accounts;

public interface IAccountService
{
    Task DeleteAsync(int userId, string password, CancellationToken ct);
}
