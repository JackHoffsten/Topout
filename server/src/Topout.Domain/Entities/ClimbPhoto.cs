namespace Topout.Domain.Entities;

public sealed class ClimbPhoto
{
    public int ClimbLogId { get; set; }
    public byte[] Jpeg { get; set; } = [];
    public int Width { get; set; }
    public int Height { get; set; }
}
