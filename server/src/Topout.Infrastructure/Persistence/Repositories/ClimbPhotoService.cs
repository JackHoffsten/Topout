using Microsoft.EntityFrameworkCore;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;
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
            if (Image.DetectFormat(bytes).Name != "JPEG")
                throw Invalid();
            var options = new DecoderOptions { MaxFrames = 1 };
            var info = Image.Identify(options, bytes);
            if (info.Width < 1 || info.Height < 1 || info.Width > 2560 || info.Height > 2560)
                throw Invalid();
            using var image = Image.Load(options, bytes);
            image.Mutate(x => x.AutoOrient());
            if (image.Width > 1600 || image.Height > 1600)
                image.Mutate(x =>
                    x.Resize(
                        new ResizeOptions { Size = new Size(1600, 1600), Mode = ResizeMode.Max }
                    )
                );
            image.Metadata.ExifProfile = null;
            image.Metadata.IccProfile = null;
            image.Metadata.XmpProfile = null;
            image.Metadata.IptcProfile = null;
            width = image.Width;
            height = image.Height;
            using var output = new MemoryStream();
            await image.SaveAsJpegAsync(
                output,
                new JpegEncoder { Quality = 85, SkipMetadata = true },
                ct
            );
            jpeg = output.ToArray();
            if (jpeg.Length > MaxBytes)
                throw Invalid();
        }
        catch (UnknownImageFormatException)
        {
            throw Invalid();
        }
        catch (InvalidImageContentException)
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
