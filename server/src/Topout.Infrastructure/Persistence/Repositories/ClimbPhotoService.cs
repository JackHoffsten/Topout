using ImageMagick;
using Microsoft.EntityFrameworkCore;
using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Infrastructure.Persistence.Repositories;

internal sealed class ClimbPhotoService(AppDbContext db) : IClimbPhotoService
{
    private const int MaxBytes = 2 * 1024 * 1024;

    private static RequestException Missing() => new(ErrorKind.NotFound, "Climbing log not found.");

    private static RequestException Invalid() =>
        new(ErrorKind.Validation, "Choose a valid photo up to 2 MB after resizing.");

    private async Task CheckOwner(int userId, int id, CancellationToken ct)
    {
        if (!await db.ClimbLogs.AnyAsync(x => x.Id == id && x.UserId == userId, ct))
            throw Missing();
    }

    private static ClimbPhotoResponse Response(ClimbPhoto photo) =>
        new(Convert.ToBase64String(photo.Jpeg), photo.Width, photo.Height);

    public async Task<ClimbPhotoResponse?> GetAsync(int userId, int climbId, CancellationToken ct)
    {
        await CheckOwner(userId, climbId, ct);
        var photo = await db
            .ClimbPhotos.AsNoTracking()
            .SingleOrDefaultAsync(x => x.ClimbLogId == climbId, ct);
        return photo == null ? null : Response(photo);
    }

    public async Task<ClimbPhotoResponse> SaveAsync(
        int userId,
        int climbId,
        string base64,
        CancellationToken ct
    )
    {
        await CheckOwner(userId, climbId, ct);
        if (string.IsNullOrEmpty(base64) || base64.Length > ((MaxBytes + 2) / 3) * 4)
            throw Invalid();
        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(base64);
        }
        catch (FormatException)
        {
            throw Invalid();
        }
        if (bytes.Length > MaxBytes)
            throw Invalid();
        int width,
            height;
        byte[] jpeg;
        try
        {
            // Decode only normalized JPEG uploads, with bounded dimensions and one frame.
            if (bytes.Length < 3 || bytes[0] != 0xff || bytes[1] != 0xd8 || bytes[2] != 0xff)
                throw Invalid();
            var options = new MagickReadSettings { Format = MagickFormat.Jpeg, FrameCount = 1 };
            using var info = new MagickImage();
            info.Ping(bytes, options);
            if (info.Width < 1 || info.Height < 1 || info.Width > 2560 || info.Height > 2560)
                throw Invalid();
            using var image = new MagickImage(bytes, options);
            image.AutoOrient();
            if (image.Width > 1600 || image.Height > 1600)
                image.Resize(new MagickGeometry(1600, 1600));
            image.Strip();
            width = checked((int)image.Width);
            height = checked((int)image.Height);
            image.Quality = 85;
            using var output = new MemoryStream();
            await image.WriteAsync(output, MagickFormat.Jpeg, ct);
            jpeg = output.ToArray();
            if (jpeg.Length > MaxBytes)
                throw Invalid();
        }
        catch (MagickException)
        {
            throw Invalid();
        }

        // Serialize replacement with climb deletion and other photo uploads.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var owner = await db
            .ClimbLogs.FromSqlInterpolated(
                $"SELECT * FROM \"ClimbLogs\" WHERE \"Id\" = {climbId} AND \"UserId\" = {userId} FOR UPDATE"
            )
            .ToListAsync(ct);
        if (owner.Count == 0)
            throw Missing();
        var photo = await db.ClimbPhotos.SingleOrDefaultAsync(x => x.ClimbLogId == climbId, ct);
        if (photo == null)
        {
            photo = new ClimbPhoto { ClimbLogId = climbId };
            db.ClimbPhotos.Add(photo);
        }
        photo.Jpeg = jpeg;
        photo.Width = width;
        photo.Height = height;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Response(photo);
    }

    public async Task DeleteAsync(int userId, int climbId, CancellationToken ct)
    {
        await CheckOwner(userId, climbId, ct);
        await db
            .ClimbPhotos.Where(x =>
                x.ClimbLogId == climbId
                && db.ClimbLogs.Any(log => log.Id == x.ClimbLogId && log.UserId == userId)
            )
            .ExecuteDeleteAsync(ct);
    }
}
