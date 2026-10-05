using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddClimbPhotos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClimbPhotos",
                columns: table => new
                {
                    ClimbLogId = table.Column<int>(type: "integer", nullable: false),
                    Jpeg = table.Column<byte[]>(type: "bytea", nullable: false),
                    Width = table.Column<int>(type: "integer", nullable: false),
                    Height = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClimbPhotos", x => x.ClimbLogId);
                    table.ForeignKey(
                        name: "FK_ClimbPhotos_ClimbLogs_ClimbLogId",
                        column: x => x.ClimbLogId,
                        principalTable: "ClimbLogs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClimbPhotos");
        }
    }
}
