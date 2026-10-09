using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Topout.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ClimbingProjects : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ProjectId",
                table: "ClimbLogs",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ClimbProjects",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    IsCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    UserId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClimbProjects", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClimbProjects_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClimbLogs_ProjectId",
                table: "ClimbLogs",
                column: "ProjectId");

            migrationBuilder.CreateIndex(
                name: "IX_ClimbProjects_UserId_IsCompleted",
                table: "ClimbProjects",
                columns: new[] { "UserId", "IsCompleted" });

            migrationBuilder.AddForeignKey(
                name: "FK_ClimbLogs_ClimbProjects_ProjectId",
                table: "ClimbLogs",
                column: "ProjectId",
                principalTable: "ClimbProjects",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ClimbLogs_ClimbProjects_ProjectId",
                table: "ClimbLogs");

            migrationBuilder.DropTable(
                name: "ClimbProjects");

            migrationBuilder.DropIndex(
                name: "IX_ClimbLogs_ProjectId",
                table: "ClimbLogs");

            migrationBuilder.DropColumn(
                name: "ProjectId",
                table: "ClimbLogs");
        }
    }
}
